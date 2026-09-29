import type { StructureKind } from "../plugin.ts";

/**
 * 見出しの行から拾う葉か。見出しは節の題で、「『特別警報』とは」は下の本文が定義する語を掲げているだけで、定義ではない。
 * 定義として数えると、本文の「『特別警報』とは、…」が二度目の定義に見える。参照や数量は見出しにあっても読む。
 */
export const readsOnHeading = (kind: StructureKind): boolean => kind !== "definition";
