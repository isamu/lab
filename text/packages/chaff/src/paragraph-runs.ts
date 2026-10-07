// Runs of one-sentence paragraphs: paragraphs that follow one another with nothing but blank lines between them, each holding a
// single sentence. Pure: paragraphs and the source they are cut from come in.
import type { Paragraph } from "./plugin.ts";

/** A line break, then nothing but spaces (an ideographic space too), then another line break. */
const BLANK_LINE = /\n[^\S\n]*\n/u;

/**
 * Whether two paragraphs follow one another across a blank line and nothing else: no heading, list, table or code block between.
 * Lines joined by a single line break are one paragraph to Markdown, however the document builder splits them.
 */
const isAdjacent = (source: string, before: Paragraph, after: Paragraph): boolean => {
  const between = source.slice(before.span.end, after.span.start);
  return between.trim() === "" && BLANK_LINE.test(between);
};

/** A sentence's last mark, past closing quotes, brackets and emphasis marks. */
const SENTENCE_END = /[。．.!?！？]["'”’」』)）\]］}｝】》〕〉〛*_]*$/u;

/**
 * Whether a paragraph ends as a sentence does. One that does not is a label, a field, a line of a flattened table or a heading
 * written as plain text (日時：, Authors, 490 Ratings), which sets nothing apart.
 */
export const endsAsSentence = (source: string, paragraph: Paragraph): boolean =>
  SENTENCE_END.test(source.slice(paragraph.span.start, paragraph.span.end).trim());

/**
 * Each run of adjacent one-sentence paragraphs, in document order, as the paragraphs it holds. A paragraph of two sentences or
 * more, a paragraph that does not end as a sentence, or anything between two paragraphs, ends the run.
 */
export const oneSentenceRuns = (source: string, paragraphs: readonly Paragraph[]): Paragraph[][] =>
  paragraphs.reduce<Paragraph[][]>((runs, paragraph, at) => {
    if (paragraph.sentences.length !== 1 || !endsAsSentence(source, paragraph)) return runs;
    const previous = paragraphs[at - 1];
    const current = runs.at(-1);
    const continues = previous !== undefined && current?.at(-1) === previous && isAdjacent(source, previous, paragraph);
    if (continues) current.push(paragraph);
    else runs.push([paragraph]);
    return runs;
  }, []);
