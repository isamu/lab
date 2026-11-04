import type { MarkupHeading, Span } from "./plugin.ts";
import { escapeRegExp } from "./orthography.ts";

// Where a document quotes one of its own headings within a line of other words: an article citing itself
// (常川真央. Machine-actionable DMPs(maDMPs)の動向. カレントアウェアネス.).

/** A heading shorter than this is a word or two (概要, (1)), which the text repeats as a word, not as a quoted title. */
const MIN_TITLE_LENGTH = 8;

/** A line's list marker: a line that holds only one and the heading is a table of contents' entry. */
const LIST_MARKER = /^(?:[-*+]|\d+\.) /u;

const lineAround = (source: string, start: number, end: number): string =>
  source.slice(source.lastIndexOf("\n", start - 1) + 1, source.indexOf("\n", end) === -1 ? source.length : source.indexOf("\n", end));

/**
 * The places in `source`, outside the heading itself and outside a line that is only the heading (a table of contents),
 * where the text repeats a heading of MIN_TITLE_LENGTH or more that holds one of `marks`.
 */
export const ownTitleQuoteSpans = (source: string, headings: readonly MarkupHeading[], marks: ReadonlySet<string>): Span[] =>
  headings
    .filter((heading) => heading.text.length >= MIN_TITLE_LENGTH && heading.text.split("").some((char) => marks.has(char)))
    .flatMap((heading) =>
      [...source.matchAll(new RegExp(escapeRegExp(heading.text), "gu"))]
        .map((match) => ({ start: match.index, end: match.index + heading.text.length }))
        .filter((span) => span.start < heading.start || span.start >= heading.end)
        .filter((span) => lineAround(source, span.start, span.end).trim().replace(LIST_MARKER, "").trim() !== heading.text),
    );
