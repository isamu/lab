/** 1 つの対（「don't」と「do not」）が、文書の中でそれぞれ何回出てくるか。 */
export type PairUses = { readonly short: number; readonly long: number };

/**
 * その対で少ないほうの書きかた。"short" なら短縮形、"long" なら長い形、少数派が無ければ undefined。
 * 片方しか出てこない対は揃っている。両方が同じ回数なら、どちらを指しても当て推量になる。
 */
export const pairMinority = (uses: PairUses): "short" | "long" | undefined => {
  if (uses.short === 0 || uses.long === 0 || uses.short === uses.long) return undefined;
  return uses.short < uses.long ? "short" : "long";
};
