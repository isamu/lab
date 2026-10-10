// revision-direction-mismatch: a forecast said to be revised one way whose revision table moves the other way
// (structure/revision-direction.ts). The words are revision-direction (rise, fall) and the labels of the previous and
// revised forecasts revision-column (previous, revised); the sections start at the headings, whose words the prose masks
// and this puts back.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { revisionDirectionMismatches, type RevisionWords } from "../structure/revision-direction.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { proseWithCells } from "../table-cells.ts";
import { quoteAround } from "./quote-around.ts";

const patternsOf = (doc: ProseDocument, lexicon: string, group: string): string[] =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => entry.group === group).map((entry) => entry.pattern);

const wordsOf = (doc: ProseDocument): RevisionWords => ({
  rises: patternsOf(doc, "revision-direction", "rise"),
  falls: patternsOf(doc, "revision-direction", "fall"),
  previous: patternsOf(doc, "revision-column", "previous"),
  revised: patternsOf(doc, "revision-column", "revised"),
});

export const revisionDirection: Detector = (doc): Finding[] => {
  const headings = doc.markup?.headings ?? [];
  const text = proseWithCells(
    proseAndTablesOf(doc),
    headings.map((heading) => ({ ...heading, text: doc.source.slice(heading.start, heading.end) })),
  );
  const input = {
    text,
    sectionStarts: headings.map((heading) => heading.start),
    units: [...headings, ...doc.sentences.map((sentence) => sentence.span)],
  };
  return revisionDirectionMismatches(input, wordsOf(doc)).map((issue) => ({
    rule: "revision-direction-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
