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
 * A mark a paragraph opens with to set itself out as an item (○ a case, ・ a point, ※ a note). A run of such paragraphs is a
 * list the writer marked by hand, not prose split into one-sentence paragraphs. A doubled mark (○○県, ○●) stands for a name.
 */
const ITEM_MARK = /^[ \t\u3000]*[○◯◎●・•■□◆◇▪▫★☆▶►➢✓※＊](?![○◯◎●・•■□◆◇▪▫★☆▶►➢✓※＊])/u;

/** A speaker's mark in minutes (○委員長（石井章君）\u3000…): it opens a turn of speech, which is prose. */
const SPEAKER_MARK = /^[ \t\u3000]*[○◯〇][^\s（）()、。，．「」『』:：]{1,20}(?:（[^）\n]{0,40}）)?\u3000/u;

/** Whether a paragraph opens with an item mark rather than a speaker's mark. */
export const opensAsItem = (source: string, paragraph: Paragraph): boolean => {
  const text = source.slice(paragraph.span.start, paragraph.span.end);
  return ITEM_MARK.test(text) && !SPEAKER_MARK.test(text);
};

/**
 * Each run of adjacent one-sentence paragraphs, in document order, as the paragraphs it holds. A paragraph of two sentences or
 * more, a paragraph that does not end as a sentence or opens with an item mark, or anything between two paragraphs, ends the run.
 */
export const oneSentenceRuns = (source: string, paragraphs: readonly Paragraph[]): Paragraph[][] =>
  paragraphs.reduce<Paragraph[][]>((runs, paragraph, at) => {
    if (paragraph.sentences.length !== 1 || !endsAsSentence(source, paragraph) || opensAsItem(source, paragraph)) return runs;
    const previous = paragraphs[at - 1];
    const current = runs.at(-1);
    const continues = previous !== undefined && current?.at(-1) === previous && isAdjacent(source, previous, paragraph);
    if (continues) current.push(paragraph);
    else runs.push([paragraph]);
    return runs;
  }, []);
