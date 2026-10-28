// Paragraphs that stand in a repeated slot of the layout, where the document writes captions rather than sentences: a
// one-line summary right under each of several headings, the term line of a term-then-explanation run, and the lines of
// a run of one-line items. A slot is read as captions only when it repeats and none of its lines closes with the period,
// so a slot mixing both forms is still left to missing-final-period. Pure.
import type { Paragraph, Section } from "../plugin.ts";

/** How a paragraph looks to the slots: whether it is one line, and whether that line closes with the period. */
export type SlotParagraph = { readonly span: { readonly start: number; readonly end: number }; readonly oneLine: boolean; readonly closed: boolean };

/** A slot is a layout only when it repeats at least this often. */
const MIN_REPEATS = 3;

const isOpenLine = (paragraph: SlotParagraph | undefined): boolean => paragraph !== undefined && paragraph.oneLine && !paragraph.closed;

/** The indexes of a slot when it repeats and none of its paragraphs is closed. */
const captionsOf = (slot: readonly number[], paragraphs: readonly SlotParagraph[]): number[] =>
  slot.length >= MIN_REPEATS && slot.every((index) => isOpenLine(paragraphs[index])) ? [...slot] : [];

/** The paragraph a section's body opens with, when nothing stands between the heading and it. */
const openingParagraph = (text: string, section: Section, paragraphs: readonly SlotParagraph[]): number | undefined => {
  const index = paragraphs.findIndex((paragraph) => paragraph.span.start >= section.span.start && paragraph.span.start < section.span.end);
  const paragraph = paragraphs[index];
  return paragraph !== undefined && text.slice(section.span.start, paragraph.span.start).trim() === "" ? index : undefined;
};

/** Where a section sits: its depth, and the heading it stands under (the last section before it that is less deep). */
const siblingKey = (sections: readonly Section[], index: number): string => {
  const depth = sections[index]?.depth ?? 0;
  const parent = sections.slice(0, index).findLastIndex((section) => section.depth < depth);
  return `${parent}:${depth}`;
};

/** The one-line paragraphs that open sibling sections: a summary under each heading (気づき / 家族の変化に気づいて、声をかける). */
const headingSlots = (text: string, sections: readonly Section[], paragraphs: readonly SlotParagraph[]): number[][] => {
  const bySiblings = new Map<string, number[]>();
  sections.forEach((section, sectionIndex) => {
    const index = section.depth > 0 ? openingParagraph(text, section, paragraphs) : undefined;
    if (index === undefined || paragraphs[index]?.oneLine !== true) return;
    const key = siblingKey(sections, sectionIndex);
    bySiblings.set(key, [...(bySiblings.get(key) ?? []), index]);
  });
  return [...bySiblings.values()];
};

/** Runs of an open one-line paragraph followed by a closed one: a term, then the sentence that explains it. */
const termSlots = (paragraphs: readonly SlotParagraph[]): number[][] =>
  paragraphs.reduce<number[][]>((runs, paragraph, index) => {
    if (!isOpenLine(paragraph) || paragraphs[index + 1]?.closed !== true) return runs;
    const run = runs.at(-1);
    if (run !== undefined && run.at(-1) === index - 2) run.push(index);
    else runs.push([index]);
    return runs;
  }, []);

/** Runs of one-line paragraphs written on consecutive lines, with no blank line between: the items of a list or a table of contents. */
const lineSlots = (text: string, paragraphs: readonly SlotParagraph[]): number[][] =>
  paragraphs.reduce<number[][]>((runs, paragraph, index) => {
    if (!paragraph.oneLine) return runs;
    const previous = paragraphs[index - 1];
    const run = runs.at(-1);
    const adjacent = previous !== undefined && previous.oneLine && !text.slice(previous.span.end, paragraph.span.start).includes("\n\n");
    if (adjacent && run !== undefined && run.at(-1) === index - 1) run.push(index);
    else runs.push([index]);
    return runs;
  }, []);

/** The indexes of the paragraphs that are captions in a repeated slot, not sentences left open. */
export const captionParagraphs = (text: string, sections: readonly Section[], paragraphs: readonly SlotParagraph[]): ReadonlySet<number> =>
  new Set(
    [...headingSlots(text, sections, paragraphs), ...termSlots(paragraphs), ...lineSlots(text, paragraphs)].flatMap((slot) => captionsOf(slot, paragraphs)),
  );

/** The slot view of a document's paragraphs; closed says whether a paragraph's last line ends with the period. */
export const slotParagraphs = (text: string, paragraphs: readonly Paragraph[], closed: (line: string) => boolean): SlotParagraph[] =>
  paragraphs.map((paragraph) => {
    const body = text.slice(paragraph.span.start, paragraph.span.end).trim();
    return { span: paragraph.span, oneLine: !body.includes("\n"), closed: closed(body.split("\n").at(-1)?.trim() ?? "") };
  });
