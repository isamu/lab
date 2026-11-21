// The paragraphs of near-verbatim minutes that open with a speaker's name ("Mara: There's some history ..."). What
// follows the name is that person's own phrasing as the note-taker recorded it, not the writer's. Pure.
import type { Span } from "../plugin.ts";

/** How many names must each open MIN_TURNS paragraphs: one or two repeated labels are fields (Status:, Comments:). */
const MIN_SPEAKERS = 3;
const MIN_TURNS = 3;
/** The share of the paragraphs the names must open, so a few labelled lines in a report do not make it minutes. */
const MIN_TURN_SHARE = 0.2;

/** A name of up to three words, written at the very start of the paragraph, a colon, then the words said. */
const TURN = /^(?<name>\p{L}[\p{L}'’.-]*(?: \p{Lu}[\p{L}'’.-]*){0,2}): +\S/u;
const BLANK_LINES = /\n[ \t\r]*(?:\n[ \t\r]*)+/gu;

type Paragraph = { readonly span: Span; readonly name: string | undefined };

const paragraphsOf = (source: string): Paragraph[] => {
  const breaks = [...source.matchAll(BLANK_LINES)];
  const starts = [0, ...breaks.map((found) => found.index + found[0].length)];
  const ends = [...breaks.map((found) => found.index), source.length];
  return starts
    .map((start, index) => ({ start, end: ends[index] ?? source.length }))
    .filter(({ start, end }) => source.slice(start, end).trim() !== "")
    .map((span) => ({ span, name: TURN.exec(source.slice(span.start, span.end))?.groups?.["name"] }));
};

const turnCounts = (paragraphs: readonly Paragraph[]): Map<string, number> =>
  paragraphs.reduce((counts, { name }) => (name === undefined ? counts : counts.set(name, (counts.get(name) ?? 0) + 1)), new Map<string, number>());

/** The spans of the paragraphs a speaker's name opens, when the document reads as minutes of who said what; else none. */
export const speakerTurns = (source: string): Span[] => {
  const paragraphs = paragraphsOf(source);
  const turns = paragraphs.filter((paragraph) => paragraph.name !== undefined);
  const speakers = [...turnCounts(turns).values()].filter((count) => count >= MIN_TURNS).length;
  if (speakers < MIN_SPEAKERS || turns.length < paragraphs.length * MIN_TURN_SHARE) return [];
  return turns.map((turn) => turn.span);
};
