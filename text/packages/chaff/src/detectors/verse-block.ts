import type { Span } from "../plugin.ts";

// Stanzas: blocks of lines between blank lines where every line opens with a capital, as a verse line does, in a document
// where several such blocks also run a sentence on across a line into a capital ("How public, like a frog / To tell…").
// Prose wrapped at a column goes on in lower case, and prose with one sentence a line ends each line with its sentence.

const VERSE_LINE = /^[\t ]*["'“‘(]?\p{Lu}/u;
const SENTENCE_CLOSE = /[.!?]["'”’)\]]*[\t ]*$/u;
/** The run-on stanzas a document needs before its capitalised blocks are read as verse: one may be a list of names. */
const MIN_RUN_ON_STANZAS = 3;
const MIN_LINES = 2;

type Block = { start: number; end: number; readonly lines: string[] };

/** The runs of lines between blank lines, each with its span in the source. */
const blocksOf = (source: string): Block[] => {
  const blocks: Block[] = [];
  const state = { offset: 0, open: false };
  source.split("\n").forEach((line) => {
    const start = state.offset;
    state.offset += line.length + 1;
    if (line.trim() === "") {
      state.open = false;
      return;
    }
    const last = blocks.at(-1);
    if (state.open && last !== undefined) {
      last.end = start + line.length;
      last.lines.push(line);
      return;
    }
    blocks.push({ start, end: start + line.length, lines: [line] });
    state.open = true;
  });
  return blocks;
};

const isCapitalised = (lines: readonly string[]): boolean => lines.every((line) => VERSE_LINE.test(line));

/** A line inside the block, past its first, that runs on into the next: a first line alone may be a caption ("Article 1 Purpose"). */
const runsOn = (lines: readonly string[]): boolean => lines.slice(1, -1).some((line) => !SENTENCE_CLOSE.test(line));

/** The spans of the source's stanzas, sorted by start and never overlapping; none when the document is not verse. */
export const verseBlockSpans = (source: string): Span[] => {
  const blocks = blocksOf(source).filter(({ lines }) => lines.length >= MIN_LINES && isCapitalised(lines));
  const runOn = blocks.filter(({ lines }) => runsOn(lines)).length;
  return runOn >= MIN_RUN_ON_STANZAS ? blocks.map(({ start, end }) => ({ start, end })) : [];
};
