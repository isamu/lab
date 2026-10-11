import type { Span } from "./plugin.ts";

// 空白を挟んで書いた姓と名（高瀬 誠、佐伯 未咲）を、解析器の品詞に頼らず、前後の語で人の名前と読む。解析器は姓を地名やふつうの
// 名詞と読み、名を二語に切ることがあるので、姓と名を一つの名前にできない。後ろに敬称か肩書き（様、部長）が付くか、人を書く欄
// （氏名：、承認者：）の行の終わりにあれば、人の名前と読む。

/** suffixes は敬称（様、さん）、titles は名前のすぐ後ろの肩書き（部長）、labels は人を書く欄の語（氏名、承認者）。語彙表から。 */
export type SpacedNameCues = { readonly suffixes: readonly string[]; readonly titles: readonly string[]; readonly labels: readonly string[] };

export type SpacedName = { readonly surname: Span; readonly given: Span };

/** 姓と名それぞれの字数の上限。長い漢字の連なり（営業部長）は姓でない。 */
const MAX_PART = 3;
/** 姓の前を読む範囲（UTF-16 の単位）。姓より長い漢字の連なりを、長いまま見るため。 */
const LOOKBACK = 12;
const NAME_SPACE = /[ 　]/gu;
const HAN = /^\p{Script=Han}$/u;
const TRAILING_HAN = /\p{Script=Han}+$/u;
const LEADING_HAN = /^\p{Script=Han}+/u;
const ONE_SPACE = /^[ 　]/u;
/** 欄の語と名前のあいだに置かない記号。文の中の「：」の後ろは欄ではない。 */
const NOT_IN_FIELD = /[。、，,：:]/u;
const FIELD_COLON = /[：:]/u;
/** 欄の行の頭の、Markdown の印（箇条書き、引用、見出し）。 */
const LINE_MARKS = /^[\s>*#+-]*/u;
/** 欄の名前の後ろ: 行の終わり。日付などの括弧一つで行が終わってもよい（髙瀬 誠（2026年4月1日））。 */
const FIELD_END = /^[ 　]*(?:[（(][^（()）\n]*[）)][ 　]*)?(?:\r?\n|$)/u;

const isHan = (letter: string | undefined): boolean => letter !== undefined && HAN.test(letter);

/** 人を書く欄の行（承認者：営業部長 高瀬 誠）で、姓が欄の語の後ろにあるか。 */
const isInPersonField = (source: string, surnameStart: number, labels: readonly string[]): boolean => {
  const head = source.slice(source.lastIndexOf("\n", surnameStart - 1) + 1, surnameStart);
  const colon = head.search(FIELD_COLON);
  if (colon < 0 || NOT_IN_FIELD.test(head.slice(colon + 1))) return false;
  const label = head.slice(0, colon).replace(LINE_MARKS, "").trimEnd();
  return labels.some((word) => label.endsWith(word));
};

/** 空白の後ろの漢字の連なりの頭から、敬称か肩書きの前までを名と読む（誠部長 の 誠、健太 様 の 健太）。 */
const givenBeforeSuffix = (run: string, after: string, words: readonly string[]): string | undefined => {
  const letters = [...run];
  return letters
    .slice(0, MAX_PART)
    .map((_letter, index) => letters.slice(0, index + 1).join(""))
    .find((given) => {
      const rest = given.length === run.length ? after.replace(ONE_SPACE, "") : run.slice(given.length) + after;
      return words.some((word) => rest.startsWith(word));
    });
};

const givenAt = (source: string, start: number, cues: SpacedNameCues, inField: boolean): string | undefined => {
  const run = LEADING_HAN.exec(source.slice(start, start + LOOKBACK))?.[0];
  if (run === undefined) return undefined;
  const after = source.slice(start + run.length, start + run.length + LOOKBACK);
  const suffixed = givenBeforeSuffix(run, after, [...cues.suffixes, ...cues.titles]);
  if (suffixed !== undefined) return suffixed;
  return inField && [...run].length <= MAX_PART && FIELD_END.test(after) ? run : undefined;
};

/** 空白の前の漢字の連なり。字数が姓の形で、肩書きや敬称で終わらない（部長 高瀬様 の 部長 は姓でない）。 */
const surnameBefore = (source: string, space: number, cues: SpacedNameCues): string | undefined => {
  const window = source.slice(Math.max(0, space - LOOKBACK), space);
  const run = TRAILING_HAN.exec(window)?.[0];
  if (run === undefined || [...run].length > MAX_PART) return undefined;
  return [...cues.titles, ...cues.suffixes].some((word) => run.endsWith(word)) ? undefined : run;
};

/** 空白を挟んだ姓と名で、後ろに敬称か肩書きが付くか、人を書く欄の行の終わりにあるもの。 */
export const spacedPersonNamesIn = (source: string, cues: SpacedNameCues): SpacedName[] =>
  [...source.matchAll(NAME_SPACE)].flatMap((match) => {
    const space = match.index;
    if (!isHan([...source.slice(Math.max(0, space - 2), space)].at(-1)) || !isHan([...source.slice(space + 1, space + 3)][0])) return [];
    const surname = surnameBefore(source, space, cues);
    if (surname === undefined) return [];
    const surnameStart = space - surname.length;
    const given = givenAt(source, space + 1, cues, isInPersonField(source, surnameStart, cues.labels));
    return given === undefined ? [] : [{ surname: { start: surnameStart, end: space }, given: { start: space + 1, end: space + 1 + given.length } }];
  });
