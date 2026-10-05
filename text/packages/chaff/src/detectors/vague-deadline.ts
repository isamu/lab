// A time limit a contract leaves to the reader (速やかに, 遅滞なく, promptly, within a reasonable time) where the same
// contract writes most of its limits as numbers (7日以内, within thirty days): who decides whether 速やかに was met?
// Which way to write limits is the drafter's choice; only the minority in one document is pointed at. A sentence that
// also gives a number of days (速やかに、遅くとも7日以内に) has a deadline. The words come from the language package's
// word lists: vague-deadline (the vague limits) and concrete-deadline (what a stated limit is written with). Pure.
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding, ProseDocument } from "../plugin.ts";

export type VagueDeadline = { readonly offset: number; readonly word: string };

type Text = { readonly start: number; readonly text: string };

type Hit = { readonly at: number; readonly word: string };

const LATIN = /\p{Script=Latin}/u;
const LETTER = /\p{L}/u;

/** An English word is not read inside a longer one (promptly in unpromptly). */
const isWordAt = (text: string, word: string, at: number): boolean =>
  !LATIN.test(word) || (!LETTER.test(text.charAt(at - 1)) && !LETTER.test(text.charAt(at + word.length)));

const indexesOf = (text: string, word: string): number[] => {
  const found: number[] = [];
  let at = text.indexOf(word);
  while (at !== -1) {
    found.push(at);
    at = text.indexOf(word, at + word.length);
  }
  return found;
};

const statesConcrete = (text: Text, concrete: readonly string[]): boolean => {
  const lower = text.text.toLowerCase();
  return concrete.some((word) => word !== "" && lower.includes(word.toLowerCase()));
};

/** A hit inside a longer hit at the same place (速やかに in 可及的速やかに) is that longer word. */
const isInsideLonger = (hit: Hit, hits: readonly Hit[]): boolean =>
  hits.some((other) => other.word.length > hit.word.length && other.at <= hit.at && hit.at + hit.word.length <= other.at + other.word.length);

/** The vague limits in one sentence, in order. Matching ignores case. */
const vagueIn = (text: Text, vague: readonly string[]): VagueDeadline[] => {
  const lower = text.text.toLowerCase();
  const hits = vague
    .filter((word) => word !== "")
    .flatMap((word) =>
      indexesOf(lower, word.toLowerCase())
        .filter((at) => isWordAt(lower, word, at))
        .map((at) => ({ at, word })),
    );
  return hits
    .filter((hit) => !isInsideLonger(hit, hits))
    .toSorted((left, right) => left.at - right.at)
    .map((hit) => ({ offset: text.start + hit.at, word: text.text.slice(hit.at, hit.at + hit.word.length) }));
};

/**
 * Each vague limit in a sentence that states no concrete one, when more sentences of the document state a concrete one
 * than hold a vague one: the vague limits are then the document's minority.
 */
export const vagueDeadlines = (texts: readonly Text[], vague: readonly string[], concrete: readonly string[]): VagueDeadline[] => {
  const perSentence = texts.map((text) => (statesConcrete(text, concrete) ? [] : vagueIn(text, vague)));
  const vagueSentences = perSentence.filter((hits) => hits.length > 0).length;
  const concreteSentences = texts.filter((text) => statesConcrete(text, concrete)).length;
  return concreteSentences > vagueSentences ? perSentence.flat() : [];
};

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

export const vagueDeadline: Detector = (doc): Finding[] =>
  vagueDeadlines(
    doc.sentences.map((sentence) => ({ start: sentence.span.start, text: sentence.text })),
    patternsOf(doc, "vague-deadline"),
    patternsOf(doc, "concrete-deadline"),
  ).map((hit) => ({
    rule: "vague-deadline",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, hit.offset),
    values: { word: hit.word, offset: hit.offset },
  }));
