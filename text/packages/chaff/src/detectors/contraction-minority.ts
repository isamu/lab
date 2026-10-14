/** 一方の書きかたが文書に何種類、全部で何回出てくるか。 */
export type FormCounts = { readonly kinds: number; readonly uses: number };

/**
 * 少数派はどちらか。true なら短縮形、false なら長い形、少数派が無ければ undefined。
 * 種類の少ないほう、同数なら回数の少ないほう。どちらも同数なら少数派は無い。
 * 「it's」1 つと「does not」1 つは、決めた文体を 1 か所だけ破ったものではなく、どちらを指しても当て推量になる。
 */
export const contractionMinority = (contracted: FormCounts, spelledOut: FormCounts): boolean | undefined => {
  if (contracted.kinds === 0 || spelledOut.kinds === 0) return undefined;
  if (contracted.kinds !== spelledOut.kinds) return contracted.kinds < spelledOut.kinds;
  if (contracted.uses !== spelledOut.uses) return contracted.uses < spelledOut.uses;
  return undefined;
};
