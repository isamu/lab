// A bibliographic citation written out as a sentence, as in a footnote: authors and the year in parentheses, then a title
// or a publisher. Its length is the length of the reference, not of the writer's prose. Pure.
import { escapeRegExp } from "../orthography.ts";

/** "Keys and Reina (2025)," or "Federal Housing Finance Agency (n.d.),": the year in parentheses, a comma after it. */
const AUTHOR_YEAR = /\((?:\d{4}[a-z]?|n\.d\.)\),/u;

/** What only a reference carries: a quoted title right after the year, a place and publisher, or a page range. */
const PUBLICATION_MARKS: readonly RegExp[] = [/\((?:\d{4}[a-z]?|n\.d\.)\),\s*["“]/u, /\([\p{Lu}][^():]*:\s[^()]+\)/u, /\bpp\.\s*\d/u];

export const isCitationSentence = (text: string): boolean => AUTHOR_YEAR.test(text) && PUBLICATION_MARKS.some((mark) => mark.test(text));

const signalPattern = (signals: readonly string[]): RegExp | undefined =>
  signals.length === 0 ? undefined : new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${signals.map(escapeRegExp).join("|")})(?![\p{L}\p{N}])`, "giu");

/**
 * The writer's own words in a citation sentence: what comes before the last citation signal ("see", from the language's
 * word list) ahead of the first year. "For example, see Lisa Cook (2024), …" leads with "For example,"; a sentence that is
 * only a citation leads with nothing. Undefined when the sentence is not a citation.
 */
export const citationLead = (text: string, signals: readonly string[]): string | undefined => {
  if (!isCitationSentence(text)) return undefined;
  const beforeYear = text.slice(0, text.search(AUTHOR_YEAR));
  const pattern = signalPattern(signals);
  const lastSignal = pattern === undefined ? undefined : [...beforeYear.matchAll(pattern)].at(-1);
  return lastSignal === undefined ? "" : beforeYear.slice(0, lastSignal.index).trim();
};
