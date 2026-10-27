import { escapeRegExp } from "../orthography.ts";
import type { LexiconEntry, Paragraph, Sentence, Span } from "../plugin.ts";

// Sentences that are not the writer's running prose and so are not compared for register: wording quoted under a label
// (例：…, Q: …, a paragraph under a lone 用例), the value of a field set out under a marked label line (■ 調査目的\n…) and a contact
// block (a paragraph with a 〒 or 電話： line). A note on a ※ line and a cell of a table laid out as lines are set apart too, but
// stay counted: only some of a table's cells take the shape, and dropping those would leave the rest a smaller minority. Pure.

/** A label, a number after it (Q1, 例2), then the mark that ends it. */
const labelPattern = (labels: readonly LexiconEntry[]): RegExp | undefined =>
  labels.length === 0 ? undefined : new RegExp(`^(?:${labels.map((label) => escapeRegExp(label.pattern)).join("|")})[0-9０-９-]*[ \\t\\u3000]*[:：)）]`, "u");

/** A paragraph that is nothing but a label (用例, 例：), which sets the next paragraph out as quoted wording. */
const isLoneLabel = (text: string, labels: readonly LexiconEntry[]): boolean => {
  const words = text.trim().replace(/[:：]$/u, "");
  return labels.some((label) => label.pattern === words);
};

const textOf = (source: string, paragraph: Paragraph): string => source.slice(paragraph.span.start, paragraph.span.end);

/** The sentences that open with a quote label, and those of a paragraph right after a lone label. */
export const labelledQuoteSentences = (paragraphs: readonly Paragraph[], source: string, labels: readonly LexiconEntry[]): Set<Sentence> => {
  const opener = labelPattern(labels);
  if (opener === undefined) return new Set();
  return new Set(
    paragraphs.flatMap((paragraph, index) => {
      const previous = paragraphs[index - 1];
      if (previous !== undefined && isLoneLabel(textOf(source, previous), labels)) return paragraph.sentences;
      return paragraph.sentences.filter((sentence) => opener.test(sentence.text.trim()));
    }),
  );
};

/** A line that opens with a contact mark or label (〒173-8501, 電話：03-…): the mark, then a colon, a space or a digit. */
const contactLinePattern = (openers: readonly LexiconEntry[]): RegExp | undefined =>
  openers.length === 0
    ? undefined
    : new RegExp(`^[ \\t\\u3000]*(?:${openers.map((opener) => escapeRegExp(opener.pattern)).join("|")})[ \\t\\u3000]*[:：0-9０-９]`, "mu");

const BLANK_LINE = /\n[^\S\n]*\n/gu;

/** The blocks of lines between blank lines. The document builder may cut a block of short lines into several paragraphs. */
const blocksOf = (source: string): Span[] => {
  const gaps = [...source.matchAll(BLANK_LINE)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
  return [...gaps, { start: source.length, end: source.length }].map((gap, index) => ({ start: gaps[index - 1]?.end ?? 0, end: gap.start }));
};

/**
 * The sentences of a contact block: lines between blank lines, one of them the page's address or numbers. Its wording
 * (…へのお問い合わせは専用フォームをご利用ください。) is the page's, not the text's.
 */
export const contactBlockSentences = (sentences: readonly Sentence[], source: string, openers: readonly LexiconEntry[]): Set<Sentence> => {
  const contactLine = contactLinePattern(openers);
  if (contactLine === undefined || !contactLine.test(source)) return new Set();
  const contacts = blocksOf(source).filter((block) => contactLine.test(source.slice(block.start, block.end)));
  return new Set(sentences.filter((sentence) => contacts.some((block) => sentence.span.start >= block.start && sentence.span.start < block.end)));
};

/** A marked label line (■ 調査目的): a square or diamond mark, then words that do not end as a sentence. */
const FIELD_LABEL = /^[ \t\u3000]*[■□◆◇▪▫][^\n。．.!?！？]*$/u;

/** Where the value starts in a block whose first line is a marked label line, or undefined. */
const valueStartOf = (source: string, block: Span): number | undefined => {
  const lineEnd = source.indexOf("\n", block.start);
  if (lineEnd === -1 || lineEnd >= block.end || !FIELD_LABEL.test(source.slice(block.start, lineEnd))) return undefined;
  return lineEnd;
};

/**
 * The sentences on the lines under a marked label line in the same block. A field's value (■ 調査目的\n…の参考とする。) is written
 * as forms write it, whatever the register of the text around the fields.
 */
export const fieldValueSentences = (sentences: readonly Sentence[], source: string): Set<Sentence> => {
  const values = blocksOf(source).flatMap((block) => {
    const start = valueStartOf(source, block);
    return start === undefined ? [] : [{ start, end: block.end }];
  });
  return new Set(sentences.filter((sentence) => values.some((value) => sentence.span.start >= value.start && sentence.span.start < value.end)));
};

/** A line that opens with a reference mark (※PDFファイルが開けない…): a note set beside the text. */
const NOTE_LINE = /^[ \t\u3000]*※/u;

const lineStartOf = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

/**
 * The sentences on a line that opens with ※. A note (※…の場合はこちらをご覧ください。) is the page's aside to the reader, written in
 * its own register whatever the text around it uses.
 */
export const referenceNoteSentences = (sentences: readonly Sentence[], source: string): Set<Sentence> =>
  new Set(sentences.filter((sentence) => NOTE_LINE.test(source.slice(lineStartOf(source, sentence.span.start), sentence.span.end))));

/** A line that ends as a sentence does. */
const CLOSED_LINE = /[。．.!?！？][\s」』）)]*$/u;

/** A heading or a comment line, which a table's cells are not. */
const MARKUP_LINE = /^[ \t\u3000]*(?:#|<!--)/u;

/** A block of lines none of which ends as a sentence: a table's cell or a list of conditions, set out as their own lines. */
const isFragmentBlock = (source: string, block: Span): boolean => {
  const lines = source
    .slice(block.start, block.end)
    .split("\n")
    .filter((line) => line.trim() !== "");
  return lines.length > 0 && lines.every((line) => !CLOSED_LINE.test(line.trim()) && !MARKUP_LINE.test(line));
};

/** How many fragment blocks must stand on each side of a block for it to read as one cell of a table laid out as lines. */
const CELL_NEIGHBOURS = 2;

const isAmongFragments = (source: string, blocks: readonly Span[], index: number): boolean => {
  const sides = [blocks.slice(Math.max(0, index - CELL_NEIGHBOURS), index), blocks.slice(index + 1, index + 1 + CELL_NEIGHBOURS)];
  return sides.every((side) => side.length === CELL_NEIGHBOURS && side.every((block) => isFragmentBlock(source, block)));
};

/**
 * The sentences of a block that stands between runs of fragment blocks: a table copied from a page, its cells one per block
 * (電池の種類 / 受託要件 / 制限なし。ただし…場合がある。). A cell is written as tables write it, whatever the text around the table.
 */
export const tableCellSentences = (sentences: readonly Sentence[], source: string): Set<Sentence> => {
  const blocks = blocksOf(source).filter((block) => source.slice(block.start, block.end).trim() !== "");
  const cells = blocks.filter((_, index) => isAmongFragments(source, blocks, index));
  return new Set(sentences.filter((sentence) => cells.some((cell) => sentence.span.start >= cell.start && sentence.span.start < cell.end)));
};
