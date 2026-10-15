import type { Token } from "../plugin.ts";

/**
 * 組織の名前の前に立つ形（語彙表 organisation-form）、そのうち名前の後ろにも立つ法人格（closingForms。株式会社、監査法人）と、
 * 組織や単位の名前を閉じる語（organisation-unit）。
 */
export type OrganisationWords = { readonly forms: readonly string[]; readonly closingForms: readonly string[]; readonly units: readonly string[] };

/** 区切りの前に要る字数。1 字なら、普通の語の一部（外部・本部・課題）と見分けられない。 */
const MIN_BODY_LENGTH = 2;
const KANJI = /[一-鿿]/u;

const surfaceOf = (tokens: readonly Token[]): string => tokens.map((token) => token.surface).join("");
const isNumber = (token: Token): boolean => token.features?.["NumType"] === "Card";
const isProperPiece = (token: Token): boolean => token.pos === "PROPN" || token.features?.["NameType"] === "GeoUnit";

/** covering の語が、隙間なく続いて並ぶときだけ、その語の並び。改行などで割れていれば読まない。 */
const contiguous = (tokens: readonly Token[], covering: readonly number[]): Token[] | undefined => {
  const run = covering.flatMap((index) => tokens.slice(index, index + 1));
  const joined = run.every((token, at) => at === 0 || run[at - 1]?.span.end === token.span.start);
  return run.length === covering.length && joined ? run : undefined;
};

/**
 * 連なりのすぐ後ろの語が組織の語そのもの（幼稚園運営企画グループのグループ）なら、それも足した語の並び。
 * 漢字でない組織の語は漢字の連なりの外にあるが、名前はそこで閉じる。
 */
const withClosingUnit = (tokens: readonly Token[], covering: readonly number[], units: readonly string[]): number[] => {
  const next = (covering.at(-1) ?? -1) + 1;
  const [last, closing] = [tokens[next - 1], tokens[next]];
  const closes =
    covering.length > 0 &&
    last !== undefined &&
    closing !== undefined &&
    last.span.end === closing.span.start &&
    !KANJI.test(closing.surface) &&
    units.includes(closing.surface);
  return closes ? [...covering, next] : [...covering];
};

/** 頭の、語の切れ目で終わる組織の形（国立研究開発法人）の語数。無ければ 0。 */
const formLength = (run: readonly Token[], forms: ReadonlySet<string>): number =>
  run.reduce((found, _, at) => (forms.has(surfaceOf(run.slice(0, at + 1))) ? at + 1 : found), 0);

/** 頭の、固有名詞と地名の単位だけの並び（紀美野町、下神野地区、気象庁）の語数。固有名詞が無ければ 0。 */
const properLength = (run: readonly Token[]): number => {
  const length = run.findIndex((token) => !isProperPiece(token));
  const stretch = length === -1 ? run.length : length;
  return run.slice(0, stretch).some((token) => token.pos === "PROPN") ? stretch : 0;
};

/** 1 つの区切り（総務課、産業技術総合研究所）か。組織の語で閉じ、その前に 2 字以上の語があり、数を含まない。 */
const isSegment = (part: readonly Token[], units: readonly string[]): boolean => {
  const text = [...surfaceOf(part)];
  const closing = units.filter((unit) => text.join("").endsWith(unit));
  return !part.some(isNumber) && closing.some((unit) => text.length - [...unit].length >= MIN_BODY_LENGTH);
};

/**
 * run を区切りだけに割ったときの区切りの数の最大。割れなければ 0。
 * 後ろから、各位置から終わりまでを割れる数を一度ずつ決める（長い連なりでも語数の二乗で済む）。
 */
const segmentCount = (run: readonly Token[], units: readonly string[]): number => {
  const counts = run.reduceRight<number[]>((after, _, start) => {
    const best = run.slice(start).reduce((most, __, offset) => {
      const end = start + offset + 1;
      const rest = after[end - start - 1] ?? 0;
      const closesRun = end === run.length;
      return isSegment(run.slice(start, end), units) && (closesRun || rest > 0) ? Math.max(most, 1 + rest) : most;
    }, 0);
    return [best, ...after];
  }, []);
  return counts[0] ?? 0;
};

/**
 * 法人格で閉じ、その前に 2 字以上の名前がある（東日本自動車販売株式会社、青葉監査法人）。数を含む連なり（2024年株式会社、第三東京販売株式会社）は名前と読まない。
 * 呼び出し側は、名前に固有名詞か地名があることも求める。法令の語（株式交換完全親株式会社）は法人格で閉じても名前ではない。
 */
const endsInForm = (text: string, closingForms: readonly string[]): boolean =>
  !/[0-9０-９]/u.test(text) && closingForms.some((form) => text.endsWith(form) && [...text].length - [...form].length >= MIN_BODY_LENGTH);

/**
 * 漢字の連なりの語（covering: tokens の添字）が 1 つの組織の名前か。名前は書き手が変えられない。
 * 法人格か地名・固有名詞で始まって組織の語で閉じるもの（国立研究開発法人産業技術総合研究所、紀美野町青少年育成町民会議）、
 * または組織の語で閉じる区切りが 2 つ以上続くもの（国土交通省鉄道局総務課）。
 * 組織の語で閉じない連なり（情報処理推進機構認定試験、総務課長）や、頭に名前の無い 1 区切り（個人情報保護法施行規則改正案検討会）は名前ではない。
 */
export const isOrganisationRun = (tokens: readonly Token[], covering: readonly number[], words: OrganisationWords): boolean => {
  const run = contiguous(tokens, withClosingUnit(tokens, covering, words.units));
  if (run === undefined || run.length === 0) return false;
  if (endsInForm(surfaceOf(run), words.closingForms) && run.some(isProperPiece) && !run.some(isNumber)) return true;
  const form = formLength(run, new Set(words.forms));
  const head = form > 0 ? form : properLength(run);
  const segments = segmentCount(run.slice(head), words.units);
  return head > 0 ? segments >= 1 : segments >= 2;
};
