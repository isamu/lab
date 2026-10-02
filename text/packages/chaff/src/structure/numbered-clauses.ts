import type { StructureNode } from "../plugin.ts";

/**
 * A numbered chapter (第1章), or an article numbered at the top level (第3条, 「1 適用範囲」, "2. Payment"). Clauses
 * number from 1 at the top, so a tree whose articles are all dotted (## 0.18.0, ## 1.0 in a changelog) holds versions,
 * not clauses. A 号 item or a heading is not a clause.
 */
const isClause = (node: StructureNode): boolean => node.kind === "chapter" || (node.kind === "article" && !node.address.includes("."));

/** Pure: whether the tree holds a numbered clause anywhere. */
export const numbersClauses = (node: StructureNode): boolean => isClause(node) || node.children.some(numbersClauses);
