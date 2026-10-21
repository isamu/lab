// A note that is a reference: a line that opens with a citation ("1. See Lawrence H. Summers (2015), "Have We Entered
// …," IMF Economic Review"). Its words are the cited work's (a title's IMF, a series' FRBSF), not the writer's. Pure.
import { citationLead, isCitationSentence } from "./citation-sentence.ts";

type Span = { readonly start: number; readonly end: number };

/** A sentence and where it starts in the source. */
export type PlacedSentence = { readonly text: string; readonly span: { readonly start: number } };

/** What may stand before a note's text on its line: nothing, its number ("1.", "(2)") or a footnote label ("[^3]:"). */
const NOTE_MARK = /^(?:\d{1,3}[.)]|\(\d{1,3}\)|\[\^[^\]\s]+\]:)?$/u;

const lineStartOf = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

const lineEndOf = (source: string, offset: number): number => {
  const end = source.indexOf("\n", offset);
  return end === -1 ? source.length : end;
};

const opensLine = (source: string, offset: number): boolean => NOTE_MARK.test(source.slice(lineStartOf(source, offset), offset).trim());

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

/** A word in lower case: the writer's prose ("The SRE remains"), when it stands outside brackets and quotation marks. */
const PROSE_WORD = /(?<![\p{L}\p{N}])\p{Ll}{4,}/u;
const CLOSER_OF: Readonly<Record<string, string>> = { "(": ")", '"': '"', "“": "”" };

/** The mark that ends the bracket or quotation char opens or stays in; undefined once it closes. */
const nextCloser = (closer: string | undefined, char: string): string | undefined => {
  if (closer === undefined) return CLOSER_OF[char];
  return char === closer ? undefined : closer;
};

/** The text with what stands in brackets or quotation marks (a title, a publisher) blanked out. */
const withoutEnclosed = (text: string): string =>
  [...text]
    .reduce<{ readonly kept: string[]; closer: string | undefined }>(
      (acc, char) => {
        const inside = acc.closer !== undefined;
        acc.kept.push(inside || CLOSER_OF[char] !== undefined ? " " : char);
        acc.closer = nextCloser(acc.closer, char);
        return acc;
      },
      { kept: [], closer: undefined },
    )
    .kept.join("");

/** A sentence after the citation on its line that is still the reference: another citation, or a series and its number. */
const continuesReference = (text: string): boolean => isCitationSentence(text) || !PROSE_WORD.test(withoutEnclosed(text));

const endOf = (sentence: PlacedSentence): number => sentence.span.start + sentence.text.length;

/**
 * Each reference that opens its line, with the sentences after it on that line that are still the reference's ("63 (1),
 * pp. 277–80"; "FRBSF Economic Letter 2023-13"). joiners: the words that join authors' names (citation-author-joiner).
 */
export const citationNoteSpans = (source: string, sentences: readonly PlacedSentence[], joiners: readonly string[]): Span[] => {
  const joinerWords = new Set(joiners.flatMap((joiner) => joiner.split(/\s+/u)));
  return sentences.flatMap((sentence, index) => {
    const start = sentence.span.start;
    if (!opensWithReference(sentence.text, joinerWords) || !opensLine(source, start)) return [];
    const lineEnd = lineEndOf(source, start);
    const later = sentences.slice(index + 1);
    const stop = later.findIndex((next) => next.span.start >= lineEnd || !continuesReference(next.text));
    const last = stop === -1 ? later.at(-1) : later[stop - 1];
    return [{ start, end: Math.max(endOf(sentence), last === undefined ? 0 : endOf(last)) }];
  });
};
