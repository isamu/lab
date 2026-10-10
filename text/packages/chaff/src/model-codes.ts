// 型番の書き分け（KM-SP300 と KM-SP-300、KMSP300、km-sp300）。型番と読むのは、文書の題か型番の欄（語彙表 model-code-label）の後ろに
// 書いた、英大文字と数字を合わせた語だけ。ハイフン・空白・大小・幅を除いて同じ字の並びになるものを同じ型番と見る。字や数の違う
// 型番（KM-SP300 と KM-SP310）は別の型番なので比べない。

export type ModelCode = { readonly offset: number; readonly surface: string };
export type ModelCodeVariant = { readonly code: ModelCode; readonly usual: string };

/** 型番と読む字の数（ハイフンと空白を除く）の下限。S3 や v2 は短すぎて型番か分からない。 */
const MIN_KEY_LENGTH = 4;

const ALNUM = "A-Za-z0-9Ａ-Ｚａ-ｚ０-９";
const HYPHENS = "\\-‐‑－";
/** 型番の字の間に書いてよい区切り。 */
const SEPARATOR = `[${HYPHENS} ]?`;
/** 型番の前に来れば、より長い語・パス・URL・ファイル名・色（#FF0000）の一部。 */
const BEFORE_OTHER = new RegExp(`[${ALNUM}${HYPHENS}_./\\\\@=#]$`, "u");
/** 型番の後ろに来れば、より長い語・パス・ファイル名（.pdf）・版（.2）の一部。 */
const AFTER_OTHER = new RegExp(`^(?:[${ALNUM}${HYPHENS}_/\\\\]|\\.[${ALNUM}])`, "u");
const CODE_SHAPE = new RegExp(`[${ALNUM}]+(?:[${HYPHENS}][${ALNUM}]+)*`, "gu");
const URL = /(?:https?:\/\/|www\.)[^\s<>"'）)」]+/gu;

/** ハイフン・空白・大小・幅を除いた字の並び。同じ並びなら同じ型番。 */
export const modelCodeKey = (surface: string): string =>
  surface
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll(/[\s\-‐‑]/gu, "");

/** 英大文字と数字を両方含み、英小文字を含まない、短すぎない語。iOS17 や v1 は型番と読まない。 */
export const isModelCodeShape = (surface: string): boolean => {
  const key = modelCodeKey(surface);
  const ascii = surface.normalize("NFKC");
  return key.length >= MIN_KEY_LENGTH && /[A-Z]/u.test(ascii) && /\d/u.test(ascii) && !/[a-z]/u.test(ascii);
};

const standsAlone = (text: string, start: number, end: number): boolean =>
  !BEFORE_OTHER.test(text.slice(Math.max(0, start - 1), start)) && !AFTER_OTHER.test(text.slice(end, end + 2));

/** 範囲の中の、型番の形をした語。 */
export const codesInTitle = (text: string, start: number, end: number): ModelCode[] =>
  [...text.slice(start, end).matchAll(CODE_SHAPE)]
    .map((match) => ({ offset: start + match.index, surface: match[0] }))
    .filter((code) => isModelCodeShape(code.surface) && standsAlone(text, code.offset, code.offset + code.surface.length));

const escaped = (pattern: string): string => pattern.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/** 欄の語の直後（「：」や空白を挟んでよい）に書いた、型番の形をした語。英字の欄の語は大小を問わず、語の途中からは読まない。 */
export const codesAfterLabels = (text: string, labels: readonly string[]): ModelCode[] => {
  if (labels.length === 0) return [];
  const alternatives = labels.toSorted((left, right) => right.length - left.length).map(escaped);
  const pattern = new RegExp(
    `(?<![A-Za-z])(?:${alternatives.join("|")})(?![A-Za-z])[ \\t]*[:：]?[ \\t\\u3000]*([${ALNUM}]+(?:[${HYPHENS}][${ALNUM}]+)*)`,
    "giu",
  );
  return [...text.matchAll(pattern)]
    .map((match) => ({ offset: match.index + match[0].length - (match[1] ?? "").length, surface: match[1] ?? "" }))
    .filter((code) => isModelCodeShape(code.surface) && standsAlone(text, code.offset, code.offset + code.surface.length));
};

/** 一つの字の、大小と全角の形。 */
const charClass = (char: string): string => {
  const forms = new Set([char, char.toUpperCase(), char.toLowerCase()].flatMap((form) => [form, String.fromCodePoint((form.codePointAt(0) ?? 0) + 0xfee0)]));
  return `[${[...forms].join("")}]`;
};

const urlSpans = (text: string): { start: number; end: number }[] =>
  [...text.matchAll(URL)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

/** 字の並びが key と同じになる語のすべて。字の間にはハイフンか空白を一つまで挟んでよい。URL の中は読まない。 */
export const codesWithKey = (text: string, key: string): ModelCode[] => {
  const pattern = new RegExp([...key].map(charClass).join(SEPARATOR), "gu");
  const urls = urlSpans(text);
  return [...text.matchAll(pattern)]
    .map((match) => ({ offset: match.index, surface: match[0] }))
    .filter((code) => standsAlone(text, code.offset, code.offset + code.surface.length))
    .filter((code) => !urls.some((url) => url.start <= code.offset && code.offset < url.end));
};

const countsOf = (codes: readonly ModelCode[]): Map<string, number> =>
  codes.reduce((counts, code) => counts.set(code.surface, (counts.get(code.surface) ?? 0) + 1), new Map<string, number>());

/** 一番多く書いた形。数が同じなら、題か欄に先に書いた形。 */
const usualOf = (codes: readonly ModelCode[], anchor: string): string => {
  const counts = countsOf(codes);
  const most = Math.max(...counts.values());
  return (counts.get(anchor) ?? 0) === most ? anchor : ([...counts].find(([, count]) => count === most)?.[0] ?? anchor);
};

/** 一つの型番の、少ないほうの形。型番が二度以上出てこなければ、比べるものが無い。 */
const variantsOfKey = (text: string, anchor: ModelCode): ModelCodeVariant[] => {
  const codes = codesWithKey(text, modelCodeKey(anchor.surface));
  if (codes.length < 2) return [];
  const usual = usualOf(codes, anchor.surface);
  return codes.filter((code) => code.surface !== usual).map((code) => ({ code, usual }));
};

/**
 * 文書の型番（題か欄に書いたもの）を、ほかの所で別の形に書いた所。anchors は文書の順。同じ字の並びの型番は一度だけ見る。
 */
export const modelCodeVariants = (text: string, anchors: readonly ModelCode[]): ModelCodeVariant[] => {
  const keys = anchors.map((anchor) => modelCodeKey(anchor.surface));
  const firstPerKey = anchors.filter((_, index) => keys.indexOf(keys[index] ?? "") === index);
  return firstPerKey.flatMap((anchor) => variantsOfKey(text, anchor)).toSorted((left, right) => left.code.offset - right.code.offset);
};
