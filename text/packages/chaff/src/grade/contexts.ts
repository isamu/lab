import { documentLanguage } from "../check-source.ts";
import type { AtomKind } from "../compare/atom.ts";
import { factsOf } from "../commands/compare.ts";
import { documentFromSource } from "../commands/read-document.ts";
import { lineStarts, placeOf } from "../position.ts";
import type { ProseDocument } from "../plugin.ts";
import type { ItemReading } from "./checks.ts";
import { contextSupport, type UnreadKind } from "./context-support.ts";
import type { GradeContexts } from "./result.ts";

// An output's facts against the passages it was meant to rest on (spec §29.3, contexts): each passage read as `chaff
// compare` reads a document, so a number, date or name is the same fact here as there.

const contextPath = (index: number): string => `context-${String(index + 1)}.md`;

type Placed = { readonly line: number; readonly text: string };

/** Each sentence as written, and the lines it covers, first to last. */
const sentencesOf = (doc: ProseDocument): { readonly first: number; readonly last: number; readonly written: string }[] => {
  const starts = lineStarts(doc.source);
  return doc.sentences.map((sentence) => ({
    first: placeOf(starts, sentence.span.start).line,
    last: placeOf(starts, Math.max(sentence.span.start, sentence.span.end - 1)).line,
    written: doc.source.slice(sentence.span.start, sentence.span.end),
  }));
};

/** Sentences that state no checked fact: chaff cannot say whether a passage supports them. A fact is placed by its line and how it is written. */
const uncheckedOf = (doc: ProseDocument, facts: readonly Placed[]): number =>
  sentencesOf(doc).filter(({ first, last, written }) => !facts.some((fact) => fact.line >= first && fact.line <= last && written.includes(fact.text))).length;

export type ContextsRead = { readonly contexts: GradeContexts; readonly unread: readonly UnreadKind[] };

/** The output's checkable facts, each found in some passage or not. `allowed`: kinds the rubric lets go unsupported. */
export const contextsAgainst = async (
  texts: { readonly output: string; readonly outputPath: string; readonly outputLanguage: string; readonly contexts: readonly string[] },
  reading: ItemReading,
  allowed: ReadonlySet<AtomKind>,
): Promise<ContextsRead> => {
  const { config, genre } = reading;
  const answer = await documentFromSource(texts.outputPath, texts.output, { language: texts.outputLanguage, genre }, config, true);
  const passages = await Promise.all(
    texts.contexts.map(async (text, index) => {
      const path = contextPath(index);
      const read = await documentFromSource(path, text, { language: documentLanguage(path, text, config), genre }, config, true);
      return { extraction: factsOf(path, read, config.names).extraction, text };
    }),
  );
  const support = contextSupport(factsOf(texts.outputPath, answer, config.names).extraction, passages, allowed);
  const { checked, supported, unsupported, unread } = support;
  const uncheckedSentences = uncheckedOf(answer.doc, [...supported, ...unsupported]);
  return { contexts: { passages: passages.length, checked, supported, unsupported, uncheckedSentences }, unread };
};
