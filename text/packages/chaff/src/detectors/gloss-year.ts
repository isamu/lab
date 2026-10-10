// A date whose year is written twice, once in brackets (in another calendar), where the two name different years. Pure.
import type { StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";

/** A date node's year as written outside the brackets (from its value) and inside them (glossYear), both as Western years. */
export type GlossedDate = { readonly offset: number; readonly end: number; readonly year: number; readonly glossYear: number };

const YEAR_FIRST = /^(\d{4})(?:-|$)/u;

const glossedOf = (node: StructureNode): GlossedDate[] => {
  const glossYear = node.attrs["glossYear"];
  const year = YEAR_FIRST.exec(String(node.attrs["value"] ?? ""))?.[1];
  if (node.kind !== "date" || typeof glossYear !== "number" || year === undefined) return [];
  return [{ offset: node.span.start, end: node.span.end, year: Number(year), glossYear }];
};

/** The dates of the tree whose bracketed year differs from the year outside the brackets, in document order. */
export const yearDisagreements = (tree: StructureNode): GlossedDate[] =>
  inDocumentOrder(tree)
    .flatMap(glossedOf)
    .filter((date) => date.year !== date.glossYear);
