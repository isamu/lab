// date-stamp-order: an established date later than the last update, on the document's stamp lines (structure/stamp-order.ts).
// The stamp words come from the language's stamp-order-label lexicon, grouped into established and updated.
import type { Detector, Finding } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { stampOrderIssues } from "../structure/stamp-order.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAt } from "./structure-tree.ts";

export const dateStampOrder: Detector = (doc, options): Finding[] => {
  if (doc.structure === undefined) return [];
  const labels = options.lexicon ?? [];
  const wordsOf = (group: string): string[] => labels.filter((entry) => entry.group === group).map((entry) => entry.pattern);
  const dates = inDocumentOrder(doc.structure).flatMap((node) =>
    node.kind === "date" ? [{ offset: node.span.start, end: node.span.end, value: String(node.attrs["value"]) }] : [],
  );
  return stampOrderIssues(proseAndTablesOf(doc), dates, { established: wordsOf("established"), updated: wordsOf("updated") }).map(({ offset, values }) => {
    const { side, ...dated } = values;
    return {
      rule: "",
      severity: "info",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, offset),
      values: { ...dated, offset },
      ...(side === undefined ? {} : { variant: String(side) }),
    };
  });
};
