import type { StructureNode } from "../plugin.ts";
import type { StructureIssue } from "./issues.ts";

// A two-part number whose first part is not the number of the article it sits under (4.3 inside section 5): left over
// from a section moved or copied from elsewhere. Pure.

const labelOf = (node: StructureNode): string =>
  String(node.attrs["label"] ?? node.address)
    .normalize("NFKC")
    .trim();

const WHOLE = /^\d+$/u;
/** Only two parts: a longer label (3.0.0) is more often a version than a section number. */
const TWO_PARTS = /^(\d+)\.(\d+)$/u;

type Visit = { readonly node: StructureNode; readonly article: string | undefined };

/** Each article numbered N.M under an article numbered K, with N not K; nodes in quoting (another document's numbers) are left out. */
export const parentNumberMismatches = (tree: StructureNode, quoting: ReadonlySet<StructureNode>): StructureIssue[] => {
  const issues: StructureIssue[] = [];
  const pending: Visit[] = [{ node: tree, article: undefined }];
  for (let visit = pending.pop(); visit !== undefined; visit = pending.pop()) {
    const { node, article } = visit;
    const label = node.kind === "article" ? labelOf(node) : "";
    const first = TWO_PARTS.exec(label)?.[1];
    if (first !== undefined && article !== undefined && first !== article && !quoting.has(node)) {
      issues.push({ offset: node.span.start, values: { label, parent: article }, variant: "parent" });
    }
    const next = WHOLE.test(label) ? label : article;
    node.children.toReversed().forEach((child) => pending.push({ node: child, article: next }));
  }
  return issues;
};
