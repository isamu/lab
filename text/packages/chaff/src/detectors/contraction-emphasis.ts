import type { Span } from "../plugin.ts";

// A word emphasised alone is stressed: "does **not**" keeps the full form because a contraction cannot carry the stress,
// so it does not say which form the writer's prose uses. A longer emphasised stretch (a bold label, an italic note) is
// still the writer's prose and is counted.

/** A run of emphasis marks in the source that the prose masks out (chrome), with its place. */
type Marks = { readonly start: number; readonly end: number };

const MARK_RUN = /[*_]+/gu;
const BLANK_LINE = /\n[ \t]*\n/u;
const ONE_WORD = /^[\p{L}'’]+$/u;

const isMasked = (prose: string, start: number, end: number): boolean => prose.slice(start, end).trim() === "";

const isText = (char: string | undefined): boolean => char !== undefined && char.trim() !== "";

/** Emphasis marks the parser took as markup: masked in the prose and touching unmasked text on one side. */
const markRuns = (source: string, prose: string): (Marks & { readonly opens: boolean; readonly closes: boolean })[] =>
  [...source.matchAll(MARK_RUN)].flatMap((match) => {
    const start = match.index;
    const end = start + match[0].length;
    if (!isMasked(prose, start, end)) return [];
    const opens = isText(prose[end]);
    const closes = isText(prose[start - 1]);
    return opens || closes ? [{ start, end, opens, closes }] : [];
  });

/**
 * The words emphasised alone in the document, without their marks, in source coordinates. Emphasis does not cross a
 * blank line, so an opening mark left without its closing one in its paragraph covers nothing.
 */
type Pairing = { readonly open: Marks | undefined; readonly words: readonly Span[] };

const pairRun =
  (source: string) =>
  (state: Pairing, run: Marks & { readonly opens: boolean; readonly closes: boolean }): Pairing => {
    const { open } = state;
    if (open === undefined || !run.closes || BLANK_LINE.test(source.slice(open.end, run.start)))
      return { open: run.opens ? run : undefined, words: state.words };
    const inside = { start: open.end, end: run.start };
    return { open: undefined, words: ONE_WORD.test(source.slice(inside.start, inside.end)) ? [...state.words, inside] : state.words };
  };

export const stressedWords = (source: string, prose: string): readonly Span[] =>
  markRuns(source, prose).reduce<Pairing>(pairRun(source), { open: undefined, words: [] }).words;
