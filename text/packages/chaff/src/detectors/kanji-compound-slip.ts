import type { Detector, Finding, ProseDocument, Token } from "../plugin.ts";
import { compoundSlipsIn, type CompoundUse, type CompoundWord } from "../kanji-compound-slip.ts";

// Collects the document's kanji runs, from sentences, headings and table cells, each with the words the analyser cut it
// into, and hands them to compoundSlipsIn.

const KANJI_RUN = /[\p{Script=Han}々]+/gu;

/** The analyser's words over [offset, offset + run), by kanji index. A word without a reading is one the analyser does not know. */
const wordsOver = (run: string, offset: number, tokens: readonly Token[]): CompoundWord[] | undefined => {
  const chars = Array.from(run);
  const starts = chars.map((_, index) => offset + chars.slice(0, index).join("").length);
  const indexOf = (position: number): number => starts.findIndex((start) => start >= position);
  const words = tokens
    .filter((token) => token.span.start < offset + run.length && token.span.end > offset)
    .map((token) => {
      const start = Math.max(0, indexOf(token.span.start));
      const endIndex = indexOf(token.span.end);
      const crossesRun = token.span.start < offset || token.span.end > offset + run.length;
      return { start, end: endIndex === -1 ? starts.length : endIndex, known: token.reading !== undefined, crossesRun };
    });
  const covered = starts.every((_, index) => words.some((word) => word.start <= index && index < word.end));
  return covered ? words : undefined;
};

const usesIn = (text: string, base: number, tokens: readonly Token[]): CompoundUse[] =>
  [...text.matchAll(KANJI_RUN)].map((match) => {
    const offset = base + match.index;
    return { compound: match[0], offset, words: wordsOver(match[0], offset, tokens) };
  });

const shifted = (tokens: readonly Token[], by: number): Token[] =>
  tokens.map((token) => ({ ...token, span: { start: token.span.start + by, end: token.span.end + by } }));

const headingUses = (doc: ProseDocument): CompoundUse[] =>
  doc.sections
    .filter((section) => section.depth > 0)
    .flatMap((section) => {
      // A section's span starts after its heading line; a heading written differently from the source falls back to that line's start.
      const found = doc.source.lastIndexOf(section.heading, section.span.start);
      const base = found === -1 ? doc.source.lastIndexOf("\n", section.span.start - 1) + 1 : found;
      return usesIn(section.heading, base, shifted(section.headingTokens ?? [], base));
    });

const compoundUsesOf = (doc: ProseDocument): CompoundUse[] => [
  ...doc.sentences.flatMap((sentence) => usesIn(sentence.text, sentence.span.start, sentence.tokens ?? [])),
  ...headingUses(doc),
  ...(doc.tableCells?.() ?? []).flatMap((cell) => usesIn(cell.text, cell.start, cell.tokens ?? [])),
];

export const kanjiCompoundSlip: Detector = (doc, options): Finding[] => {
  const ignored = new Set((options.lexicon ?? []).flatMap((entry) => Array.from(entry.pattern)));
  return compoundSlipsIn(compoundUsesOf(doc), ignored).map((slip) => ({
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: slip.written,
    values: { written: slip.written, usual: slip.usual, count: slip.usualCount, offset: slip.offset },
  }));
};
