export type Place = { readonly line: number; readonly column: number };

/**
 * 行頭のオフセット表。1 文書につき 1 度だけ作る。
 *
 * 数えるのは **UTF-16 単位**。`[...source]` はコードポイントで数えるので、
 * 絵文字より後ろの行がすべて 1 ずれる。指摘が持つオフセットは UTF-16 なので、そちらに合わせる。
 */
export const lineStarts = (source: string): number[] => {
  const starts = [0];
  for (let at = source.indexOf("\n"); at !== -1; at = source.indexOf("\n", at + 1)) starts.push(at + 1);
  return starts;
};

/**
 * offset を含む行。starts は昇順なので二分探索で引く。指摘が何千もある長い文書で、指摘ごとに全行をなめない。
 * offset より前に行頭が無ければ（負の値、NaN）先頭の行とする。
 */
const lineIndexOf = (starts: readonly number[], offset: number): number => {
  let low = 0;
  let high = starts.length - 1;
  let found = 0;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((starts[middle] ?? Number.POSITIVE_INFINITY) <= offset) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
};

export const placeOf = (starts: readonly number[], offset: number): Place => {
  const index = lineIndexOf(starts, offset);
  return { line: index + 1, column: offset - (starts[index] ?? 0) + 1 };
};
