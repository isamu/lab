import { escapeRegExp } from "../orthography.ts";
import type { LexiconEntry } from "../plugin.ts";

// A sentence that points at another paragraph of its own article: the one before it (前項), or one by its number
// (本条1項). The words come from the language's paragraph-pointer word list: an entry in the group "previous" points at
// the paragraph before, and one with … in it is a frame whose … is the paragraph's number. Pure.

const FRAME = "…";
const PREVIOUS = "previous";
const NUMBER = "([0-9０-９]+)";
const FULL_WIDTH_OFFSET = 0xfee0;

const halfWidth = (digits: string): string =>
  [...digits].map((char) => (/[０-９]/u.test(char) ? String.fromCharCode(char.charCodeAt(0) - FULL_WIDTH_OFFSET) : char)).join("");

const numberedIn = (text: string, frame: string): number[] => {
  const pattern = new RegExp(frame.split(FRAME).map(escapeRegExp).join(NUMBER), "gu");
  return [...text.matchAll(pattern)].map((match) => Number(halfWidth(match[1] ?? "")));
};

/** The paragraphs of its article a sentence in paragraph own points at. */
export const pointedParagraphs = (text: string, own: number, pointers: readonly LexiconEntry[]): number[] =>
  pointers
    .filter((entry) => entry.pattern !== "")
    .flatMap((entry) => {
      if (entry.pattern.includes(FRAME)) return numberedIn(text, entry.pattern);
      return entry.group === PREVIOUS && text.includes(entry.pattern) ? [own - 1] : [];
    });
