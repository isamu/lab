// A bibliographic citation written out as a sentence, as in a footnote: authors and the year in parentheses, then a title
// or a publisher. Its length is the length of the reference, not of the writer's prose. Pure.
import { escapeRegExp } from "../orthography.ts";

/** "Keys and Reina (2025)," or "Federal Housing Finance Agency (n.d.),": the year in parentheses, a comma after it. */
const AUTHOR_YEAR = /\((?:\d{4}[a-z]?|n\.d\.)\),/gu;

/** What only a reference carries: a quoted title right after the year, a place and its publisher, or a page range. */
const PUBLICATION_MARKS: readonly RegExp[] = [
  /\((?:\d{4}[a-z]?|n\.d\.)\),\s*["“]/u,
  /\(\p{Lu}[\p{L}.'’-]*(?:,?\s\p{Lu}[\p{L}.'’-]*)*:\s\p{Lu}[^()]*\)/u,
  /\bpp?\.\s*\d+\s*[-–−]\s*\d+/u,
];

/** Where the citation's year stands: the last year before the first mark of a publication, or the first year when none is before it. */
const citationYearAt = (text: string): number | undefined => {
  const years = [...text.matchAll(AUTHOR_YEAR)].map((match) => match.index);
  const marks = PUBLICATION_MARKS.flatMap((mark) => {
    const found = mark.exec(text);
    return found === null ? [] : [found.index + found[0].length];
  });
  if (years.length === 0 || marks.length === 0) return undefined;
  const firstMark = Math.min(...marks);
  return years.filter((at) => at < firstMark).at(-1) ?? years[0];
};

export const isCitationSentence = (text: string): boolean => citationYearAt(text) !== undefined;

const signalPattern = (signals: readonly string[]): RegExp | undefined =>
  signals.length === 0 ? undefined : new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${signals.map(escapeRegExp).join("|")})(?![\p{L}\p{N}])`, "giu");

/**
 * The writer's own words in a citation sentence: what comes before the last citation signal ("see", from the language's
 * word list) ahead of the citation's year, or everything before the year when no signal stands there (the authors' names
 * are short). "For example, see Lisa Cook (2024), …" leads with "For example,". Undefined when the sentence is not a citation.
 */
export const citationLead = (text: string, signals: readonly string[]): string | undefined => {
  const yearAt = citationYearAt(text);
  if (yearAt === undefined) return undefined;
  const beforeYear = text.slice(0, yearAt);
  const pattern = signalPattern(signals);
  const lastSignal = pattern === undefined ? undefined : [...beforeYear.matchAll(pattern)].at(-1);
  return (lastSignal === undefined ? beforeYear : beforeYear.slice(0, lastSignal.index)).trim();
};

/** The same marks of a publication, every one of them: where an earlier reference in the text ends. */
const PUBLICATION_MARKS_ALL: readonly RegExp[] = PUBLICATION_MARKS.map((mark) => new RegExp(mark.source, "gu"));

const LEADING_SEPARATOR = /^[\s;,.]*(?:and\s+)?/u;

/**
 * The lead without the tail of an earlier reference it begins inside (…Discussion Series 2020-069 (Washington: Board of
 * Governors, August); and Ben S. Bernanke, …): a splitter that cut inside a reference list hands over the end of one
 * reference before the next one's authors. What follows the last mark of a publication is kept.
 */
export const withoutEarlierReference = (lead: string): string => {
  const ends = PUBLICATION_MARKS_ALL.flatMap((mark) => [...lead.matchAll(mark)].map((match) => match.index + match[0].length));
  return ends.length === 0
    ? lead
    : lead
        .slice(Math.max(...ends))
        .replace(LEADING_SEPARATOR, "")
        .trim();
};

/** One author as a reference list in the Vancouver style writes them: a surname, then the initials (Kreimer AR, Gail MH, Cyr JT). */
const AUTHOR = String.raw`\p{Lu}[\p{L}'’-]*\p{Ll}[\p{L}'’-]*(?: \p{Lu}[\p{L}'’-]*\p{Ll}[\p{L}'’-]*)* \p{Lu}{1,3}`;
/** Fewer authors in a row than this are a sentence naming people, not the author list of a reference. */
const MIN_AUTHORS = 3;
const AUTHOR_LIST = new RegExp(String.raw`(?<!\p{L})${AUTHOR}(?:, ${AUTHOR}){${MIN_AUTHORS - 1},}(?!\p{L})`, "gu");

/** The words an author list (Kreimer AR, Porras C, Liu D, …) adds beyond one: the authors of a reference, not the writer's sentence. */
export const authorListSaving = (text: string): number =>
  [...text.matchAll(AUTHOR_LIST)].reduce((saving, match) => saving + match[0].split(/\s+/u).length - 1, 0);
