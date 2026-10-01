import type { Span } from "./plugin.ts";

/**
 * 括弧でくくった短い句だけの行（「（経済再生）」「（目的）」）は、段落の中の小見出し。
 * 改行だけで次の文へ続けて書かれると、分割器は次の文の頭に読み込み、その文の指摘が小見出しの行に出る。
 * 小見出しは文を閉じないが、次の文へは続かないので、その行の後ろで段落を切って別々に分割する。
 *
 * かぎ括弧（「」『』）は引用で、後ろの文へ続くことがある（「…ますから」\n自分は…）ので含めない。
 * 前の行が文の途中で終わるなら、括弧の行は文の中の挿入（折り返した文）なので切らない。
 */
const PAIRS: ReadonlyMap<string, string> = new Map([
  ["（", "）"],
  ["(", ")"],
  ["【", "】"],
  ["〔", "〕"],
  ["［", "］"],
  ["[", "]"],
]);

/** 小見出しとして読む括弧の中身の字数の上限。これより長い括弧の行は、括弧でくくった注記。 */
const MAX_SUBHEADING_CHARS = 40;

/** 中身の文が終わっている。「（ただし、例外を除く。）」は注記の文で、小見出しではない。 */
const SENTENCE_END_INSIDE = /(?:[。！？!?])|(?:[.．]$)/u;
/** 行が文で終わっている。句点の後に閉じ括弧・引用符が続いてよい。 */
const ENDS_SENTENCE = /[。．！？.!?][」』"'”’)）\]］】〕]*$/u;

/** 行が、次の行を導く印（「関連記事：」）で終わっている。その次の行は前の行の続きではない。 */
const LEADS_IN = /[:：]$/u;

const NEWLINE = /\r?\n/gu;

export type Line = { readonly start: number; readonly end: number; readonly next: number };

const linesOf = (text: string): Line[] => {
  const breaks = [...text.matchAll(NEWLINE)];
  const starts = [0, ...breaks.map((match) => match.index + match[0].length)];
  return starts.map((start, index) => {
    const found = breaks[index];
    return { start, end: found?.index ?? text.length, next: found === undefined ? text.length : found.index + found[0].length };
  });
};

/** 行が、括弧一組とその中の短い句だけか。 */
export const isSubheadingLine = (line: string): boolean => {
  const trimmed = line.trim();
  const close = PAIRS.get(trimmed[0] ?? "");
  if (close === undefined || !trimmed.endsWith(close)) return false;
  const inner = trimmed.slice(1, -1);
  const chars = [...inner].length;
  return chars > 0 && chars <= MAX_SUBHEADING_CHARS && !inner.includes(close) && !inner.includes(trimmed[0] ?? "") && !SENTENCE_END_INSIDE.test(inner);
};

const hasText = (text: string, line: Line | undefined): boolean => line !== undefined && text.slice(line.start, line.end).trim().length > 0;

/** 行の範囲（text の中の位置）。その行だけで一つの項目として立つか。 */
export type StandsAlone = (start: number, end: number) => boolean;

/**
 * 一つで立つ行: 小見出しの行か standsAlone が言う行（リンクだけの行など）で、前の行が無いか、文で終わっているか、
 * 次を導く「：」で終わっているか、それも一つで立つ行。前の行が文の途中で終わるなら、その行は折り返した文の中にある。
 */
export const standaloneLines = (text: string, standsAlone: StandsAlone = () => false): Line[] => {
  const lines = linesOf(text);
  const alone = (line: Line): boolean => isSubheadingLine(text.slice(line.start, line.end)) || standsAlone(line.start, line.end);
  const startsFresh = (previous: Line | undefined): boolean => {
    if (previous === undefined || alone(previous)) return true;
    const written = text.slice(previous.start, previous.end).trimEnd();
    return ENDS_SENTENCE.test(written) || LEADS_IN.test(written);
  };
  return lines.filter((line, index) => alone(line) && startsFresh(lines[index - 1]));
};

/**
 * lines のうち、段落の終わり（end）まで切れ目なく続く後ろの並び。lines は text の順で、行は次の行の頭（next）で隣の行に続く。
 * 段落の途中の 1 行は本文の文の一つで、終わりまで続く並びだけが本文の後に置いた一覧。
 */
export const closingRun = (lines: readonly Line[], end: number): readonly Line[] =>
  lines.reduceRight<{ readonly run: readonly Line[]; readonly until: number }>(
    (acc, line) => (line.next === acc.until ? { run: [line, ...acc.run], until: line.start } : acc),
    { run: [], until: end },
  ).run;

/** 段落 text を、一つで立つ行の後ろで切った片。切る所が無ければ text 全体の 1 片。片は改行を含まない端で終わる。 */
export const subheadingPieces = (text: string, standsAlone: StandsAlone = () => false): Span[] => {
  const byStart = new Map(linesOf(text).map((line) => [line.start, line]));
  const cuts = standaloneLines(text, standsAlone).filter((line) => hasText(text, byStart.get(line.next)));
  const starts = [0, ...cuts.map((line) => line.next)];
  return starts.map((start, index) => ({ start, end: cuts[index]?.end ?? text.length }));
};
