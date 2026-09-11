export type Place = { readonly line: number; readonly column: number };

/** 行頭のオフセット表。1 文書につき 1 度だけ作る。 */
export const lineStarts = (source: string): number[] => [...source].reduce<number[]>((acc, char, index) => (char === "\n" ? [...acc, index + 1] : acc), [0]);

export const placeOf = (starts: readonly number[], offset: number): Place => {
  const index = starts.reduce((best, start, at) => (start <= offset ? at : best), 0);
  return { line: index + 1, column: offset - (starts[index] ?? 0) + 1 };
};
