import type { Detector, Finding, StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { modalConflicts, modalStatements, type Obligation } from "../structure/modal-conflict.ts";
import { linesOf, lineNumberAt } from "../structure/lines.ts";
import { quoteAt } from "./structure-tree.ts";

export const obligationsOf = (tree: StructureNode): Obligation[] =>
  inDocumentOrder(tree).flatMap((node) =>
    node.kind === "obligation"
      ? [{ start: node.span.start, end: node.span.end, type: String(node.attrs["type"] ?? ""), marker: String(node.attrs["marker"] ?? "") }]
      : [],
  );

/** 同じ主語と行為に、前の文と逆の様相（しなければならない と してはならない、may と must not）を書いた文。 */
export const modalConflict: Detector = (doc): Finding[] => {
  if (doc.structure === undefined) return [];
  const lines = linesOf(doc.source);
  return modalConflicts(modalStatements(obligationsOf(doc.structure), doc.sentences)).map(({ statement, earlier }) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, statement.offset),
    values: { marker: statement.marker, other: earlier.marker, otherLine: lineNumberAt(lines, earlier.offset) ?? 0, offset: statement.offset },
  }));
};
