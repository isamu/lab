import type { BulletList } from "./plugin.ts";

/**
 * rule-of-three の数え方。箇条書きのうち、ちょうど 3 項目のものがどれだけあるか。
 * すぐ下の行が「など」「etc.」で始まる箇条書きは、書いた 3 つより多くあると書き手が言っている。ちょうど 3 項目とは数えない。
 * 箇条書きが少ないと、1 つで割合が大きく動く（4 つなら 25 ポイント）。そのときは全部が 3 項目のときだけ報告する。
 * 2 つでも測る。生成文の報告書は「要因 3 つ」「提言 3 つ」の 2 つの箇条書きで終わることが多く、人の文書で 2 つとも 3 項目は少ない。
 * 本文の最初の文より前の箇条書き（題・日付・見出しのすぐ下の要点や概要）は数えない。項目の数はサイトの型が決めている。
 * どの項目も「札：数」の内訳も、ちょうど 3 項目とは数えない。
 */
export type ThreeShare = { readonly count: number; readonly total: number; readonly share: number; readonly first: BulletList };

const PERCENT = 100;
const THREE = 3;
/** これより少ない箇条書きは測らない。 */
const MIN_LISTS = 2;
/** これより少ない箇条書きでは、割合では判断せず、全部が 3 項目のときだけ報告する。 */
export const MIN_LISTS_FOR_SHARE = 5;

const LINE_BREAK = /\r?\n/u;

/** `from` より後ろで、最初の空でない行。 */
const nextWrittenLine = (source: string, from: number): string =>
  source
    .slice(from)
    .split(LINE_BREAK)
    .find((line) => line.trim() !== "")
    ?.trim() ?? "";

const LATIN_LETTER = /[A-Za-z]/u;

/** 英語の語は語の切れ目まで照らす（etc が etcetera の頭に当たらない）。日本語の語は字面どおり。 */
const startsWithWord = (line: string, word: string): boolean =>
  line.toLowerCase().startsWith(word.toLowerCase()) && !(LATIN_LETTER.test(word.at(-1) ?? "") && LATIN_LETTER.test(line[word.length] ?? ""));

/** 箇条書きのすぐ下の行が、並びが続くことを言う語（など、etc.）で始まる。 */
export const continuesBeyond = (source: string, list: BulletList, openWords: readonly string[]): boolean => {
  const next = nextWrittenLine(source, list.span.end);
  return openWords.some((word) => startsWithWord(next, word));
};

/** 見出し・箇条書きの項目・表の行。本文の文ではない。 */
const NOT_PROSE_LINE = /^\s*(?:#{1,6}\s|[=-]{3,}\s*$|(?:[-*+]|\d+[.)])\s|\|)/u;
/** 文の終わり（句点・ピリオド・コロン）で閉じる行。閉じ括弧や強調の記号が後ろに付いてもよい。 */
const SENTENCE_END = /[.。!?！？:：][\s"'”’」』)）*_]*$/u;

const isProseLine = (line: string): boolean => !NOT_PROSE_LINE.test(line) && SENTENCE_END.test(line.trim());

/** 本文の最初の文がある行の頭。それより前は題・日付・見出しだけ。文が無ければ文書の終わり。 */
export const firstProseOffset = (source: string): number => [...source.matchAll(/^.*$/gmu)].find(([line]) => isProseLine(line))?.index ?? source.length;

const ITEM_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/u;
const LABEL_COLON = /[:：]/u;
const DIGIT = /[0-9０-９]/u;
const EMPHASIS = /[*_]/u;
/** 札と値の長さの上限。「執務エリアの通路沿い」「大きめを2鉢」は入り、文になった値は入らない。 */
const MAX_LABEL = 20;
const MAX_VALUE = 12;

/** 太字でない短い札とコロン、その後ろに数字を含む短い値だけがある項目（「受付：大きめを2鉢」「Rent: $1,200」）。 */
const isLabelledFigure = (item: string): boolean => {
  const line = item.replace(ITEM_MARKER, "").split("\n")[0] ?? "";
  const colon = line.search(LABEL_COLON);
  const label = line.slice(0, colon);
  const value = line.slice(colon + 1).trim();
  return colon > 0 && label.length <= MAX_LABEL && !EMPHASIS.test(label) && value.length <= MAX_VALUE && DIGIT.test(value);
};

/**
 * どの項目も「札：数」の箇条書き（置き場所ごとの鉢の数、費目ごとの金額）。数の内訳で、項目の数は中身が決めている。
 * 札の側だけに数がある日程（「2026年12月：承認」）は内訳ではない。太字の札や、値が文になった項目（「**件数**：月平均 420 件届く」）は、
 * 生成文が理由を 3 つに揃える形なので内訳と読まない。
 */
export const isFigureBreakdown = (source: string, list: BulletList): boolean =>
  list.itemSpans.length > 0 && list.itemSpans.every((item) => isLabelledFigure(source.slice(item.start, item.end)));

const isExactlyThree = (source: string, list: BulletList, openWords: readonly string[]): boolean =>
  list.items.length === THREE && !continuesBeyond(source, list, openWords) && !isFigureBreakdown(source, list);

/** 報告するときの数。報告しないときは undefined。 */
export const threeShare = (source: string, allLists: readonly BulletList[], openWords: readonly string[], limit: number): ThreeShare | undefined => {
  const bodyStart = firstProseOffset(source);
  const lists = allLists.filter((list) => list.span.start >= bodyStart);
  const threes = lists.filter((list) => isExactlyThree(source, list, openWords));
  const first = threes[0];
  if (lists.length < MIN_LISTS || first === undefined) return undefined;
  const share = Math.round((threes.length / lists.length) * PERCENT);
  const reported = lists.length < MIN_LISTS_FOR_SHARE ? threes.length === lists.length : share > limit;
  return reported ? { count: threes.length, total: lists.length, share, first } : undefined;
};
