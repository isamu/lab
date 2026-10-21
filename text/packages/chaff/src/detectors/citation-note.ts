// A note that is a reference: a line that opens with a citation ("1. See Lawrence H. Summers (2015), "Have We Entered
// …," IMF Economic Review"). Its words are the cited work's (a title's IMF, a series' FRBSF), not the writer's. Pure.
import { citationLead, isCitationSentence } from "./citation-sentence.ts";

type Span = { readonly start: number; readonly end: number };

/** A sentence and where it starts in the source. */
export type PlacedSentence = { readonly text: string; readonly start: number };

/** What may stand before a note's text on its line: nothing, its number ("1.", "(2)") or a footnote label ("[^3]:"). */
const NOTE_MARK = /^\s*(?:\d{1,3}[.)]|\(\d{1,3}\)|\[\^[^\]\s]+\]:)?\s*$/u;

const lineStartOf = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

const lineEndOf = (source: string, offset: number): number => {
  const end = source.indexOf("\n", offset);
  return end === -1 ? source.length : end;
};

const opensLine = (source: string, offset: number): boolean => NOTE_MARK.test(source.slice(lineStartOf(source, offset), offset));

/** A name's word ("Summers", "See") or an initial ("H."); an acronym (IMF) or a lowercase word is the writer's. */
const NAME_WORD = /^\p{Lu}(?:\p{Ll}|\.$)/u;

/**
 * The sentence opens with the reference: every word before the citation's year is a name's (a signal such as "See", the
 * authors' names) or joins names (and, et al.). "As the IMF noted, Summers (2015)" opens with the writer's prose.
 */
const opensWithReference = (text: string, joiners: ReadonlySet<string>): boolean => {
  const lead = citationLead(text, []);
  return lead !== undefined && lead.split(/\s+/u).every((word) => word === "" || NAME_WORD.test(word) || joiners.has(word));
};

/** A word in lower case outside brackets and quotation marks: the writer's prose ("The SRE remains"), not a reference's. */
const PROSE_WORD = /(?<![\p{L}\p{N}])\p{Ll}{4,}/u;
const ENCLOSED = /\([^()]*\)|"[^"]*"|“[^”]*”/gu;

/** A sentence after the citation on its line that is still the reference: another citation, or a series and its number. */
const continuesReference = (text: string): boolean => isCitationSentence(text) || !PROSE_WORD.test(text.replaceAll(ENCLOSED, " "));

/**
 * Each reference that opens its line, with the sentences after it on that line that are still the reference's ("63 (1),
 * pp. 277–80"; "FRBSF Economic Letter 2023-13"). joiners: the words that join authors' names (citation-author-joiner).
 */
export const citationNoteSpans = (source: string, sentences: readonly PlacedSentence[], joiners: readonly string[]): Span[] => {
  const joinerWords = new Set(joiners.flatMap((joiner) => joiner.split(/\s+/u)));
  return sentences.flatMap((sentence, index) => {
    if (!opensWithReference(sentence.text, joinerWords) || !opensLine(source, sentence.start)) return [];
    const lineEnd = lineEndOf(source, sentence.start);
    const later = sentences.slice(index + 1);
    const stop = later.findIndex((next) => next.start >= lineEnd || !continuesReference(next.text));
    const last = stop === -1 ? later.at(-1) : later[stop - 1];
    const end = last === undefined ? sentence.start + sentence.text.length : last.start + last.text.length;
    return [{ start: sentence.start, end: Math.max(end, sentence.start + sentence.text.length) }];
  });
};
