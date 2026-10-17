// Words in capitals that a document itself makes known without spelling them out: a keyword of its code, a cited venue. Pure.
import { codeFences, codeSpans, withoutCodeBlocks } from "./code-fences.ts";

type Span = { readonly start: number; readonly end: number };

/** A piece of code between spaces and brackets: a hyphen, a dot, a slash or an underscore keeps a name in one piece. */
const CODE_TOKEN = /[\w./-]+/gu;
/** A keyword: a token of letters only (select, from), not a name with parts (net-http-sspi, gsa.gov, --yjit, api_key). */
const KEYWORD = /^[A-Za-z]+$/u;
/** The text of an inline link ([text](url)) or of a reference link ([text][label]). */
const LINK_TEXT = /^\[([^\]]*)\][([]/u;
/** Capitals followed by a year: a venue and when it was held (FOSDEM 2024). */
const VENUE_YEAR = /(?<![\w&])([A-Z][A-Z\d]+) (?:19|20)\d{2}(?!\d)/gu;

/**
 * The keywords a document's code (fenced blocks and inline code) writes in lower case, in capitals. Prose that writes a
 * keyword of that code in capitals (a SELECT, the WHERE clause, with select and where in the code) names the keyword; it is
 * not an acronym. A word the code too writes in capitals (`TTS`) is the acronym set as code, and gives nothing.
 */
export const codeWords = (source: string): Set<string> => {
  const blocks = codeFences(source).flatMap((fence) => fence.lines);
  const inline = codeSpans(withoutCodeBlocks(source)).map((span) => span.text);
  const tokens = [...blocks, ...inline].flatMap((code) => code.match(CODE_TOKEN) ?? []);
  return new Set(tokens.filter((token) => KEYWORD.test(token) && token !== token.toUpperCase()).map((token) => token.toUpperCase()));
};

/**
 * Capitals followed by a year in a link's text (([Jane Roe, FOSDEM 2024, 18:10](https://…))): the venue of a cited talk or
 * paper, as a reference list names one, and the link leads to it. Outside a link, a year after capitals is not read so.
 */
export const citedVenues = (source: string, links: readonly Span[]): Set<string> =>
  new Set(
    links.flatMap((link) => {
      const text = LINK_TEXT.exec(source.slice(link.start, link.end))?.[1] ?? "";
      return [...text.matchAll(VENUE_YEAR)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
    }),
  );

/** Both: the capitals a document makes known, which undefined-acronym does not ask to spell out. */
export const knownByDocument = (source: string, links: readonly Span[]): string[] => [...codeWords(source), ...citedVenues(source, links)];
