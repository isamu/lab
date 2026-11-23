import type { Span } from "./plugin.ts";

// A news dateline at the head of a paragraph ("**AUSTIN, Texas — November 24, 2026** — Tallyroot today announced …"): the
// place in capitals, a comma, the date, then a dash. It opens the lead of a press release, whose first paragraphs tell the
// whole story before any heading. Pure.

/** Emphasis or a bracket a dateline may be set in. */
const SET_IN = /^[*_[(]+/u;

/** The place: a word in capitals (AUSTIN, ST. LOUIS, NEW YORK), then a comma. */
const PLACE = /^\p{Lu}{2,}[\p{Lu}\s.'’-]*,/u;

/** The dash that ends the dateline right after its date, past the emphasis it is set in: an em or en dash, or two hyphens. */
const DATELINE_END = /^[*_)\]]*\s*(?:—|–|--)\s/u;

/** How far into the paragraph the date may end: a place, a state and a date. */
const DATELINE_REACH = 80;

/**
 * Whether the paragraph at `paragraph` opens with a dateline: a place in capitals and a comma, then a date (`dates`, as
 * the language read them) within the reach that a dash closes.
 */
export const opensWithDateline = (source: string, paragraph: Span, dates: readonly Span[]): boolean => {
  const reach = Math.min(paragraph.end, paragraph.start + DATELINE_REACH);
  const head = source.slice(paragraph.start, reach);
  const marks = SET_IN.exec(head)?.[0].length ?? 0;
  if (!PLACE.test(head.slice(marks))) return false;
  return dates.some((date) => date.start > paragraph.start && date.end <= reach && DATELINE_END.test(source.slice(date.end, paragraph.end)));
};
