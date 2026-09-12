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

export const placeOf = (starts: readonly number[], offset: number): Place => {
  const index = starts.reduce((best, start, at) => (start <= offset ? at : best), 0);
  return { line: index + 1, column: offset - (starts[index] ?? 0) + 1 };
};
