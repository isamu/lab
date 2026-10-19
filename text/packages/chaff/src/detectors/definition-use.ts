import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { definedTerms, unusedDefinitions, usesBeforeDefinition, type BodyText, type IsTitle, type Mentioned } from "../structure/definition-use.ts";
import { titleLineNumbers } from "../structure/title-lines.ts";
import { contentsLineNumbers } from "../structure/contents-lines.ts";
import { summaryLineNumbers } from "../structure/summary-lines.ts";
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

/** Markdown の見出し。文には入らないが、見出しで語を使っても、その語は文書で使われている。 */
const headingsOf = (doc: ProseDocument): BodyText[] =>
  (doc.markup?.headings ?? []).map((heading) => ({ start: heading.start, text: doc.source.slice(heading.start, heading.end) }));

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

/** 動名詞の後ろに来て、それが目的語を取る動詞だと分かる語（冠詞と所有の語）。 */
const DETERMINER_LISTS = ["article", "dependent-possessive"] as const;

/** 定義したのに、定義の外（文と見出し）で一度も使っていない語。 */
export const unusedDefinition: Detector = (doc): Finding[] => {
  if (doc.structure === undefined) return [];
  const determiners = new Set(DETERMINER_LISTS.flatMap((list) => patternsOf(doc, list)));
  return unusedDefinitions(definedTerms(doc.structure), [...bodyOf(doc), ...headingsOf(doc)], mentionedIn(doc), determiners).map((defined) =>
    findingAt(doc, defined.span.start, { term: defined.term }),
  );
};

/** 題・見出し（Markdown の見出し、章・節の行、条の前の見出しの行、番号と題だけの項目の行）と、目次・索引の行と、要約の節の上の位置か。 */
const titleIn = (doc: ProseDocument): IsTitle => {
  const lines = linesOf(doc.source);
  const headings = doc.markup?.headings ?? [];
  const numbers = new Set([
    ...titleLineNumbers(doc.structure, lines, headings),
    ...contentsLineNumbers(lines, headings, patternsOf(doc, "toc-heading")),
    ...summaryLineNumbers(lines, headings, [...patternsOf(doc, "summary-heading"), ...patternsOf(doc, "headnote-heading")]),
  ]);
  return (offset) => numbers.has(lineNumberAt(lines, offset) ?? 0);
};

/** 文の途中で括弧に入れて定義した語を、定義より前で使っている所。 */
export const useBeforeDefinition: Detector = (doc): Finding[] =>
  doc.structure === undefined
    ? []
    : usesBeforeDefinition(
        definedTerms(doc.structure),
        bodyOf(doc),
        mentionedIn(doc),
        titleIn(doc),
        patternsOf(doc, "self-prefix"),
        patternsOf(doc, "term-source-marker"),
      ).map((use) => findingAt(doc, use.offset, { term: use.term.term, defined: use.term.line }));

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
