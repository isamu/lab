import type { StructureNode } from "../plugin.ts";

/**
 * 番号の付いた条項が本文にあるのに、木にほとんど入っていない文書。PDF から取り出した契約書は、字下げが深かったり
 * 行が本文につながったりして、番号の行として読めないことが多い。そのとき構造の rule は「0 件」ではなく「読めなかった」と言う。
 */
const NUMBERED = new Set(["chapter", "article", "item"]);

/**
 * 「11.3. Liability Cap」「2.1 Term」: 二段以上の番号と、大文字で始まる語。行頭か、文の区切り（「. 12.10. Waiver」）の後ろ。
 * 語の後ろの番号（「Version 1.2 Released」「Figure 2.1 Revenue」）は条項ではない。
 * 「1.   TERM OF CONTRACT」: 行頭の一段の番号と、大文字だけの語。本文の箇条書き（「1. First」）とは分ける。
 */
const CLAUSE_NUMBERS = [/(?:^[ \t]{0,20}|[.;:][ \t]{1,10})\d{1,3}(?:\.\d{1,3}){1,4}\.?[ \t]{1,10}\p{Lu}/gmu, /^[ \t]{0,20}\d{1,3}\.[ \t]{1,10}\p{Lu}{2}/gmu];

/** 本文の条項番号がこれ以上あれば、番号で組んだ文書。 */
const MIN_CLAUSES = 5;
/** 木に入った番号が本文の条項番号のこの割合に届かなければ、読めていない。 */
const READ_SHARE = 0.25;

export type Unread = { readonly clauses: number; readonly units: number };

const numberedUnits = (tree: StructureNode): number => {
  let count = 0;
  const pending: StructureNode[] = [tree];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (NUMBERED.has(node.kind)) count += 1;
    pending.push(...node.children);
  }
  return count;
};

/** 読めていなければ、本文の条項番号の数と木の番号の数。読めていれば undefined。 */
export const unreadStructure = (source: string, tree: StructureNode): Unread | undefined => {
  const clauses = CLAUSE_NUMBERS.reduce((total, pattern) => total + [...source.matchAll(pattern)].length, 0);
  if (clauses < MIN_CLAUSES) return undefined;
  const units = numberedUnits(tree);
  return units < clauses * READ_SHARE ? { clauses, units } : undefined;
};
