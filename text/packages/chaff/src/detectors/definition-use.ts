import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { definedTerms, unusedDefinitions, usesBeforeDefinition, type BodyText, type Mentioned } from "../structure/definition-use.ts";
import { expansionConflicts, expansionsIn } from "../acronym-expansions.ts";
import { linesOf, lineNumberAt } from "../structure/lines.ts";
import { isQuotedAlone } from "../quoted-span.ts";
import { quoteAt } from "./structure-tree.ts";

const bodyOf = (doc: ProseDocument): BodyText[] => doc.sentences.map((sentence) => ({ start: sentence.span.start, text: sentence.text }));

const mentionedIn =
  (doc: ProseDocument): Mentioned =>
  (start, end) =>
    isQuotedAlone(doc.source, { start, end });

const findingAt = (doc: ProseDocument, offset: number, values: Readonly<Record<string, string | number>>): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: quoteAt(doc.source, offset),
  values: { ...values, offset },
});

/** 定義したのに、定義の外で一度も使っていない語。 */
export const unusedDefinition: Detector = (doc): Finding[] =>
  doc.structure === undefined
    ? []
    : unusedDefinitions(definedTerms(doc.structure), bodyOf(doc), mentionedIn(doc)).map((defined) => findingAt(doc, defined.span.start, { term: defined.term }));

/** 文の途中で括弧に入れて定義した語を、定義より前で使っている所。 */
export const useBeforeDefinition: Detector = (doc): Finding[] =>
  doc.structure === undefined
    ? []
    : usesBeforeDefinition(definedTerms(doc.structure), bodyOf(doc), mentionedIn(doc)).map((use) => findingAt(doc, use.offset, { term: use.term.term, defined: use.term.line }));

/** 同じ略語を、文書の中で二通りに展開している所。 */
export const acronymExpansionConflict: Detector = (doc): Finding[] => {
  const lines = linesOf(doc.source);
  return expansionConflicts(bodyOf(doc).flatMap(expansionsIn)).map(({ expansion, first }) =>
    findingAt(doc, expansion.offset, {
      acronym: expansion.acronym,
      name: expansion.name,
      first: first.name,
      firstLine: lineNumberAt(lines, first.offset) ?? 0,
    }),
  );
};
