// A note that is a reference: a line that opens with a citation ("1. See Lawrence H. Summers (2015), "Have We Entered
// …," IMF Economic Review"). Its words are the cited work's (a title's IMF, a series' FRBSF), not the writer's. Pure.
import { citationLead } from "./citation-sentence.ts";

type Span = { readonly start: number; readonly end: number };

/** A sentence and where it starts in the source. */
export type PlacedSentence = { readonly text: string; readonly start: number };

/** A note's number or mark before its text: "1.", "-", "[^3]:". Letters other than a footnote's label make it prose. */
const NOTE_MARK = /\[\^[^\]\s]*\]:?/gu;
const LETTER = /\p{L}/u;

const lineStartOf = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

const lineEndOf = (source: string, offset: number): number => {
  const end = source.indexOf("\n", offset);
  return end === -1 ? source.length : end;
};

const opensLine = (source: string, offset: number): boolean => !LETTER.test(source.slice(lineStartOf(source, offset), offset).replaceAll(NOTE_MARK, ""));

const CAPITALISED = /^\p{Lu}/u;

/**
 * The sentence opens with the reference: every word before the citation's year is capitalised (a signal such as "See",
 * the authors' names) or joins names (and, et al.). "As the IMF noted, Summers (2015)" opens with the writer's prose.
 */
const opensWithReference = (text: string, joiners: ReadonlySet<string>): boolean => {
  const lead = citationLead(text, []);
  return lead !== undefined && lead.split(/\s+/u).every((word) => word === "" || CAPITALISED.test(word) || joiners.has(word));
};

/**
 * From each reference that opens its line to the end of that line: the rest of the note is the reference's too.
 * joiners: the words that join authors' names, from the language's citation-author-joiner list.
 */
export const citationNoteSpans = (source: string, sentences: readonly PlacedSentence[], joiners: readonly string[]): Span[] => {
  const joinerWords = new Set(joiners.flatMap((joiner) => joiner.split(/\s+/u)));
  return sentences.flatMap((sentence) =>
    opensWithReference(sentence.text, joinerWords) && opensLine(source, sentence.start)
      ? [{ start: sentence.start, end: lineEndOf(source, sentence.start) }]
      : [],
  );
};
