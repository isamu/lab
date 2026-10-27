import type { BulletList } from "./plugin.ts";

/**
 * rule-of-three の数え方。箇条書きのうち、ちょうど 3 項目のものがどれだけあるか。
 * すぐ下の行が「など」「etc.」で始まる箇条書きは、書いた 3 つより多くあると書き手が言っている。ちょうど 3 項目とは数えない。
 * 箇条書きが少ないと、1 つで割合が大きく動く（4 つなら 25 ポイント）。そのときは全部が 3 項目のときだけ報告する。
 */
export type ThreeShare = { readonly count: number; readonly total: number; readonly share: number; readonly first: BulletList };

const PERCENT = 100;
const THREE = 3;
/** これより少ない箇条書きは測らない。 */
const MIN_LISTS = 3;
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

const isExactlyThree = (source: string, list: BulletList, openWords: readonly string[]): boolean =>
  list.items.length === THREE && !continuesBeyond(source, list, openWords);

/** 報告するときの数。報告しないときは undefined。 */
export const threeShare = (source: string, lists: readonly BulletList[], openWords: readonly string[], limit: number): ThreeShare | undefined => {
  const threes = lists.filter((list) => isExactlyThree(source, list, openWords));
  const first = threes[0];
  if (lists.length < MIN_LISTS || first === undefined) return undefined;
  const share = Math.round((threes.length / lists.length) * PERCENT);
  const reported = lists.length < MIN_LISTS_FOR_SHARE ? threes.length === lists.length : share > limit;
  return reported ? { count: threes.length, total: lists.length, share, first } : undefined;
};
