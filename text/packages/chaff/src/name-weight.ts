// 同じ名前の二つの書き方のうち、どちらを正しい形と見るか。多く書いたほう。どちらも一度だけなら、人を書く欄（氏名：、
// Contractor:）に書いたほう。欄に書いた名前は、書き手が確かめて書いた形。

/** count は文書の中で書いた数、labelled はどれかの現れを人を書く欄に書いたか。 */
export type NameWeight = { readonly count: number; readonly labelled: boolean };

/** 並べたとき重いほうが先。数が多いほう、同数なら欄に書いたほう。 */
export const heavierFirst = (left: NameWeight, right: NameWeight): number => right.count - left.count || Number(right.labelled) - Number(left.labelled);

/** 一度だけ書いた slip を、other の書き損じと見てよいか。other が二度以上か、どちらも一度だけで other だけを欄に書いたとき。 */
export const outweighs = (other: NameWeight, slip: NameWeight): boolean =>
  slip.count === 1 && (other.count >= 2 || (other.count === 1 && other.labelled && !slip.labelled));
