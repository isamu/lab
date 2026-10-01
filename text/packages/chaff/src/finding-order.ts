/** 指摘を文書の中の位置の順に並べる。同じ行では桁の順。rule ごとの並びを残さない。 */
export const byPosition = (left: { readonly line: number; readonly column: number }, right: { readonly line: number; readonly column: number }): number =>
  left.line - right.line || left.column - right.column;
