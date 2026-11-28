import type { Detector, ProseDocument } from "../plugin.ts";
import { openerPile } from "./ai-phrasing.ts";

// A document written in a casual voice on purpose: headings asked as questions (なんで植物？) and sentences ending in an
// exclamation mark. There a spoken word fits the voice the writer chose, and is no slip. Pure.

const EXCLAMATION = /[!！]$/u;
const QUESTION = /[?？]$/u;
/** One mark may be a slip or a quotation; two set the voice of the whole document. */
const MIN_CASUAL_MARKS = 2;

const CLOSERS = new Set(["」", "』", "）", ")"]);

/** The text without the closing brackets at its end, so that 「…！」 ends in its mark. */
const closingMark = (text: string): string => {
  const chars = [...text.trim()];
  const end = chars.findLastIndex((char) => !CLOSERS.has(char));
  return chars.slice(0, end + 1).join("");
};

/** The marks of a casual voice: sentences ending in "!" and headings ending in "?". */
export const casualMarks = (doc: ProseDocument): number =>
  doc.sentences.filter((sentence) => sentence.embeddedLanguage === undefined && EXCLAMATION.test(closingMark(sentence.text))).length +
  doc.sections.filter((section) => section.depth > 0 && QUESTION.test(section.heading.trim())).length;

/** Whether the writer chose a casual voice for the whole document. */
export const writesCasually = (doc: ProseDocument): boolean => casualMarks(doc) >= MIN_CASUAL_MARKS;

/** A spoken conjunction at a sentence's head (なので、), unless the whole document is written in a casual voice that it fits. */
export const colloquialOpenerPile: Detector = (doc, options) => (writesCasually(doc) ? [] : openerPile(doc, options));
