import type { StructureNode } from "../plugin.ts";

// A reference named with a longer form of the document's own name (本共同研究開発契約第6条 where 本契約 is the document's
// short own name) points into another document only when the document calls itself by the short form; otherwise the
// longer form is the document's own name (本利用規約 with no 本規約) and the reference stays in it. The language package
// marks such a reference with document and ownName; this pass decides, over the whole text. Pure.

const resolved = (node: StructureNode, source: string): StructureNode => {
  const children = node.children.map((child) => resolved(child, source));
  const ownName = node.attrs["ownName"];
  if (typeof ownName !== "string") return children.every((child, index) => child === node.children[index]) ? node : { ...node, children };
  const elsewhere = source.includes(ownName);
  const attrs = Object.fromEntries(Object.entries(node.attrs).filter(([key]) => key !== "ownName" && (elsewhere || key !== "document")));
  return { ...node, attrs, children };
};

/** The tree with each ownName-marked reference kept in another document or brought back into this one. */
export const resolveOwnNames = (tree: StructureNode, source: string): StructureNode => resolved(tree, source);
