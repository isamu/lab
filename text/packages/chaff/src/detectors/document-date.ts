// The document's own date: the first date of its date-stamp paragraph (a paragraph that is only a date, or 「更新日：」).
import type { ProseDocument, StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { dateStampIndexes, stampCandidates } from "../date-stamp.ts";

/** The date of the document's date stamp as the tree reads it ("2026-10-06", or "2026" for a year alone), when it has one. */
export const documentDateOf = (doc: ProseDocument, tree: StructureNode): string | undefined => {
  const dates = inDocumentOrder(tree).flatMap((node) => (node.kind === "date" ? [{ ...node.span, value: String(node.attrs["value"]) }] : []));
  const candidates = stampCandidates(
    doc.source,
    doc.paragraphs.map((paragraph) => paragraph.span),
    dates,
  );
  const labels = (doc.lexicons["date-stamp-label"] ?? []).map((entry) => entry.pattern);
  const stamps = dateStampIndexes(candidates, labels);
  const paragraph = doc.paragraphs.find((_, index) => stamps.has(index));
  return paragraph === undefined ? undefined : dates.find((candidate) => candidate.start >= paragraph.span.start && candidate.end <= paragraph.span.end)?.value;
};
