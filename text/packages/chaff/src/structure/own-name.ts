import type { StructureNode } from "../plugin.ts";
import { foldPostOrder } from "../tree-walk.ts";

// A reference named with a longer form of the document's own name (本共同研究開発契約第6条 where 本契約 is the document's
// short own name) points into another document only when the document calls itself by the short form; otherwise the
// longer form is the document's own name (本利用規約 with no 本規約) and the reference stays in it. The language package
// marks such a reference with document and ownName; this pass decides, over the whole text. Pure.

const resolvedAttrs = (attrs: StructureNode["attrs"], ownName: string, source: string): StructureNode["attrs"] => {
  const elsewhere = source.includes(ownName);
  return Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== "ownName" && (elsewhere || key !== "document")));
};

/** One node rebuilt over its resolved children; a node whose children did not change and that holds no marker is kept as it was. */
const resolved = (node: StructureNode, children: readonly StructureNode[], source: string): StructureNode => {
  const ownName = node.attrs["ownName"];
  const same = children.every((child, index) => child === node.children[index]);
  if (typeof ownName !== "string") return same ? node : { ...node, children };
  return { ...node, attrs: resolvedAttrs(node.attrs, ownName, source), children };
};

/** The tree with each ownName-marked reference kept in another document or brought back into this one. Read without recursion: a tree may be thousands of levels deep. */
export const resolveOwnNames = (tree: StructureNode, source: string): StructureNode =>
  foldPostOrder<StructureNode, StructureNode>(
    tree,
    (node) => node.children,
    (node, children) => resolved(node, children, source),
  );
