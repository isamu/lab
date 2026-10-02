import type { Span } from "../plugin.ts";

/** 文の始まりの昇順の列で、span をすっかり含む文の番号。無ければ -1。二分探索で引く。 */
const sentenceIndexOf = (sentences: readonly Span[], span: Span): number => {
  let low = 0;
  let high = sentences.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const sentence = sentences[middle];
    if (sentence === undefined) return -1;
    if (span.start < sentence.start) high = middle - 1;
    else if (span.start >= sentence.end) low = middle + 1;
    else return span.end <= sentence.end ? middle : -1;
  }
  return -1;
};

/** span を文ごとに分ける。文をまたぐ span はどの文にも入れない。文の数 × span の数を回らないため。 */
export const bySentence = <T extends Span>(sentences: readonly Span[], spans: readonly T[]): ReadonlyMap<number, readonly T[]> => {
  const buckets = new Map<number, T[]>();
  spans.forEach((span) => {
    const index = sentenceIndexOf(sentences, span);
    if (index === -1) return;
    const bucket = buckets.get(index);
    if (bucket === undefined) buckets.set(index, [span]);
    else bucket.push(span);
  });
  return buckets;
};
