// The max-sentence-length plant for `yarn bench`: adjacent sentences joined until one passes the limit.

import { isJapanese, isProse, isRow, linesOf, lowerFirst, replaceLine, splitSentences, type Plant, type PlantContext } from "./bench-text.ts";

/** Adjacent sentences of one line, from `at`, that pass the limit once joined: `count` of them, `length` long together. */
type Run = { readonly index: number; readonly at: number; readonly count: number; readonly length: number; readonly sentences: readonly string[] };

const sentenceLength = (sentence: string): number => (isJapanese(sentence) ? [...sentence.trim()].length : sentence.trim().split(/\s+/u).length);

/** From `at`, the fewest sentences (two at least) whose joined length passes the limit, or undefined when the line runs out first. */
const runFrom = (sentences: readonly string[], index: number, at: number, limit: number): Run | undefined => {
  const lengths = sentences.slice(at).map(sentenceLength);
  const totals = lengths.map((_, end) => lengths.slice(0, end + 1).reduce((sum, length) => sum + length, 0));
  const last = totals.findIndex((total, end) => end >= 1 && total > limit);
  return last === -1 ? undefined : { index, at, count: last + 1, length: totals[last] ?? 0, sentences };
};

const runsOf = (line: string, index: number, limit: number): Run[] => {
  const sentences = splitSentences(line).filter((sentence) => sentence.trim() !== "");
  return sentences.flatMap((_, at) => runFrom(sentences, index, at, limit) ?? []);
};

const joinTwo = (first: string, second: string): string =>
  isJapanese(first) ? `${first.replace(/。$/u, "、")}${second}` : `${first.replace(/[.!?]$/u, ",")} and ${lowerFirst(second)}`;

const joinedLine = (run: Run): string => {
  const [first = "", ...rest] = run.sentences.slice(run.at, run.at + run.count);
  const joined = rest.reduce(joinTwo, first);
  return [...run.sentences.slice(0, run.at), joined, ...run.sentences.slice(run.at + run.count)].join(isJapanese(run.sentences.join("")) ? "" : " ");
};

/** Fewer sentences first (a pair over the limit beats three), then the longer one. */
const isBetterRun = (run: Run, best: Run | undefined): boolean =>
  best === undefined || run.count < best.count || (run.count === best.count && run.length > best.length);

/**
 * 並んだ文をつないで、上限を超える一文にする。二文で超える組があれば、いちばん長くなる二文。無ければ三文、四文と増やす。
 * 一行の文を全部つないでも上限に届かなければ植えない。
 */
export const joinSentences = (source: string, context: PlantContext): Plant | undefined => {
  const lines = linesOf(source);
  const limit = context.limits["max-sentence-length"];
  if (limit === undefined) return undefined;
  const runs = lines.flatMap((line, index) => (isProse(line) && !isRow(line) ? runsOf(line, index, limit) : []));
  const chosen = runs.reduce<Run | undefined>((best, run) => (isBetterRun(run, best) ? run : best), undefined);
  return chosen === undefined ? undefined : { source: replaceLine(lines, chosen.index, joinedLine(chosen)), line: chosen.index + 1 };
};
