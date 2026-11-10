import type { Detector, Finding, ProseDocument, StructureNode } from "../plugin.ts";
import {
  definedTerms,
  unusedDefinitions,
  usesBeforeDefinition,
  type BodyText,
  type DefinedTerm,
  type IsTitle,
  type Mentioned,
} from "../structure/definition-use.ts";
import { titleLineNumbers } from "../structure/title-lines.ts";
import { contentsLineNumbers } from "../structure/contents-lines.ts";
import { summarisesLaterDefinition, summarySections } from "../structure/summary-lines.ts";
import { expansionConflicts, expansionsIn } from "../acronym-expansions.ts";
import { linesOf, lineNumberAt } from "../structure/lines.ts";
import { isQuotedAlone } from "../quoted-span.ts";
import { quoteAt } from "./structure-tree.ts";
import { articlesInCitedDocuments } from "../structure/cited-document-section.ts";

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

/**
 * 題・見出し（Markdown の見出し、章・節の行、条の前の見出しの行、番号と題だけの項目の行）と、目次・索引の行の上の位置か。
 * 要約の節の行は、定義がその節の外にあるときだけ（要約は本文の定義を先取りして縮めたもの）。
 */
const titleIn = (doc: ProseDocument): IsTitle => {
  const lines = linesOf(doc.source);
  const headings = doc.markup?.headings ?? [];
  const numbers = new Set([...titleLineNumbers(doc.structure, lines, headings), ...contentsLineNumbers(lines, headings, patternsOf(doc, "toc-heading"))]);
  const summaries = summarySections(lines, headings, [
    ...patternsOf(doc, "summary-heading"),
    ...patternsOf(doc, "headnote-heading"),
    ...patternsOf(doc, "introduction-heading"),
  ]);
  return (offset, definedAt) => {
    const line = lineNumberAt(lines, offset) ?? 0;
    return numbers.has(line) || summarisesLaterDefinition(summaries, line, lineNumberAt(lines, definedAt) ?? 0);
  };
};

/** 他の文書を引き写した節の条（「## 参考：根拠条文」の下の第9条）の定義は、その文書の定義で、この文書の語の定義ではない。 */
const ownDefinitions = (tree: StructureNode): DefinedTerm[] => {
  const cited = articlesInCitedDocuments(tree).map((article) => article.span);
  return definedTerms(tree).filter((term) => !cited.some((span) => span.start <= term.span.start && term.span.start < span.end));
};

/** 文の途中で括弧に入れて定義した語を、定義より前で使っている所。 */
export const useBeforeDefinition: Detector = (doc): Finding[] =>
  doc.structure === undefined
    ? []
    : usesBeforeDefinition(
        ownDefinitions(doc.structure),
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
