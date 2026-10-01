import type { Detector, Finding, Span } from "../plugin.ts";
import { isJapanese } from "../orthography.ts";

/**
 * 見えない字の種類。zero-width はゼロ幅の空白・接合子と途中の BOM、soft-hyphen は任意の改行位置の印、direction は文字の向きの指定、
 * control は改行・タブ・改ページ以外の制御文字、hidden は字の後ろに隠せる印（タグ文字、二つ以上続く異体字の指定）、
 * nbsp は普通の空白が要る所のノーブレークスペース。どれも画面では見えず、検索・コピー・リンクを壊す。向きの指定と隠せる印は、
 * 読み手に見えるものと機械が読むものを食い違わせるのにも使える。
 */
export type InvisibleKind = "zero-width" | "soft-hyphen" | "direction" | "control" | "hidden" | "nbsp";

/**
 * 種類ごとの字（正規表現の文字クラスの中身）。制御文字（Cc）には改行・タブ・改ページも入るので、それは isIntended が外す。
 * hidden の異体字の指定は、字に一つ付いたものを isIntended が外す。
 */
const CLASSES: readonly (readonly [string, InvisibleKind])[] = [
  ["\\u200B-\\u200D\\u2060-\\u2064\\uFEFF", "zero-width"],
  ["\\u00AD", "soft-hyphen"],
  ["\\u200E\\u200F\\u061C\\u202A-\\u202E\\u2066-\\u2069", "direction"],
  ["\\p{Cc}", "control"],
  ["\\u{E0001}\\u{E0020}-\\u{E007F}\\p{Variation_Selector}", "hidden"],
  ["\\u00A0\\u2007\\u202F", "nbsp"],
];

const KIND_OF: readonly (readonly [RegExp, InvisibleKind])[] = CLASSES.map(([chars, kind]) => [new RegExp(`^[${chars}]$`, "u"), kind]);

/** 一字ずつ当てる。タグ文字と異体字の指定は BMP の外にもあるので u で読む。 */
const CANDIDATE = new RegExp(`[${CLASSES.map(([chars]) => chars).join("")}]`, "gu");

const kindOf = (char: string): InvisibleKind | undefined => KIND_OF.find(([pattern]) => pattern.test(char))?.[1];

/** 接合子（ZWJ・ZWNJ）で字の形を変える文字体系。アラビア文字やインドの文字では、見えない接合子が綴りの一部。 */
const JOINING_SCRIPT = /[\p{L}\p{M}]/u;
const NON_JOINING_SCRIPT = /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** 右から左に書く文字。この字の隣の向きの印（LRM・RLM）は、英数字と混ぜて正しく並べるためのもの。 */
const RIGHT_TO_LEFT = /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}]/u;

/** 絵文字の部品。ZWJ でつないだ絵文字（家族・職業）と、肌の色や異体字の指定を挟んだもの。 */
const PICTOGRAPH = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F]/u;

/** 黒い旗の絵文字の後ろにタグ文字を並べた、地域の旗（イングランドなど）の書きかけ。地域の名は六字まで。 */
const FLAG_SO_FAR = /\u{1F3F4}[\u{E0020}-\u{E007E}]{0,6}$/u;
const FLAG_REACH = 14;
const TAG = /[\u{E0020}-\u{E007F}]/u;

const VARIATION_SELECTOR = /\p{Variation_Selector}/u;

/** 文書の形を作る制御文字（タブ・改行・改ページ）。 */
const LAYOUT_CONTROL = /[\t\n\r\f]/u;

/** Markdown の行の頭の印（見出し・箇条・番号・引用）。後ろの空白がノーブレークスペースだと、印として読まれない。 */
const BLOCK_MARKER = /^[ \t]*(?:#{1,6}|[-*+]|\d{1,9}[.)]|>)$/u;
const JAPANESE_MARK = /[、。「」『』（）・]/u;

/** at の前の一字（サロゲートの対は一字に）。文書の頭なら空。 */
const charBefore = (source: string, at: number): string => {
  if (at <= 0) return "";
  const low = source.charCodeAt(at - 1);
  const isLow = low >= 0xdc00 && low <= 0xdfff;
  return isLow && at >= 2 ? source.slice(at - 2, at) : source.slice(at - 1, at);
};

/** at から始まる一字。文書の終わりなら空。 */
const charAt = (source: string, at: number): string => {
  const code = source.codePointAt(at);
  return code === undefined ? "" : String.fromCodePoint(code);
};

const isJoiningLetter = (char: string): boolean => JOINING_SCRIPT.test(char) && !NON_JOINING_SCRIPT.test(char);

const isJapaneseSide = (char: string): boolean => isJapanese(char) || JAPANESE_MARK.test(char);

const isInFlag = (source: string, at: number): boolean => FLAG_SO_FAR.test(source.slice(Math.max(0, at - FLAG_REACH), at));

/** 字が普通に使う異体字の指定は一つ。二つ以上続く指定は、字に何かを隠した並び。 */
const isLoneSelector = (source: string, at: number, length: number): boolean =>
  !VARIATION_SELECTOR.test(charBefore(source, at)) && !VARIATION_SELECTOR.test(charAt(source, at + length));

const lineBefore = (source: string, at: number): string => source.slice(source.lastIndexOf("\n", at - 1) + 1, at);

/** 書き手が意味を持たせて置いた見えない字か。そうでないものだけを指摘する。 */
const isIntended = (source: string, at: number, char: string, kind: InvisibleKind): boolean => {
  const [before, after] = [charBefore(source, at), charAt(source, at + char.length)];
  if (char === "\u200D") return (PICTOGRAPH.test(before) && PICTOGRAPH.test(after)) || isJoiningLetter(before) || isJoiningLetter(after);
  if (char === "\u200C") return isJoiningLetter(before) || isJoiningLetter(after);
  if (/^[\u200E\u200F\u061C]$/u.test(char)) return RIGHT_TO_LEFT.test(before) || RIGHT_TO_LEFT.test(after);
  if (kind === "control") return LAYOUT_CONTROL.test(char);
  if (kind === "hidden") return TAG.test(char) ? isInFlag(source, at) : isLoneSelector(source, at, char.length);
  if (kind === "nbsp") return !BLOCK_MARKER.test(lineBefore(source, at)) && !isJapaneseSide(before) && !isJapaneseSide(after);
  return false;
};

export type InvisibleRun = { readonly span: Span; readonly kind: InvisibleKind; readonly codes: readonly string[] };

export const codePointName = (char: string): string => `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`;

const joinRuns = (runs: InvisibleRun[], next: InvisibleRun): InvisibleRun[] => {
  const last = runs.at(-1);
  if (last === undefined || last.span.end !== next.span.start || last.kind !== next.kind) return [...runs, next];
  const codes = last.codes.includes(next.codes[0] ?? "") ? last.codes : [...last.codes, ...next.codes];
  return [...runs.slice(0, -1), { span: { start: last.span.start, end: next.span.end }, kind: last.kind, codes }];
};

/** source の中の、見えない字の並び。隣り合う同じ種類の字は一つの並びにまとめる。 */
export const invisibleRuns = (source: string): InvisibleRun[] =>
  [...source.matchAll(CANDIDATE)]
    .flatMap((match): InvisibleRun[] => {
      const kind = kindOf(match[0]);
      if (kind === undefined || isIntended(source, match.index, match[0], kind)) return [];
      return [{ span: { start: match.index, end: match.index + match[0].length }, kind, codes: [codePointName(match[0])] }];
    })
    .reduce<InvisibleRun[]>(joinRuns, []);

/** 見せる前後の字数。 */
const QUOTE_REACH = 20;

/** 見えない字を「⟨U+200B⟩」のように見える形にして、前後を引く。 */
export const visibleQuote = (source: string, span: Span): string =>
  source
    .slice(Math.max(0, span.start - QUOTE_REACH), span.end + QUOTE_REACH)
    .replace(CANDIDATE, (char) => (LAYOUT_CONTROL.test(char) ? char : `⟨${codePointName(char)}⟩`))
    .replace(/\s+/gu, " ")
    .trim();

export const invisibleCharacter: Detector = (doc): Finding[] =>
  invisibleRuns(doc.source).map((run) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: visibleQuote(doc.source, run.span),
    values: { code: run.codes.join(" "), count: [...doc.source.slice(run.span.start, run.span.end)].length, offset: run.span.start },
    variant: run.kind,
  }));
