import type { Detector, Finding } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { formMinority } from "./form-minority.ts";
import { quoteAround } from "./quote-around.ts";

// One document writing an ellipsis two ways ("..." and "…", "……" and "・・・"). Neither is called right; the less common is
// reported. The forms come from each language's lexicon "ellipsis".

/** One ellipsis as written. form is the lexicon's pattern it matched. */
export type WrittenEllipsis = { readonly offset: number; readonly form: string };

/** Characters an ellipsis is made of. A longer run ("....", "…・") is not read, since its form is unclear. */
const ELLIPSIS_PART = "[.．…・‥]";

/** A digit or a slash beside the dots: a range (1...10), a path (docs/.../index.md) or a page number after a leader (第1章・・・3). */
const NOT_PROSE_BESIDE = /[\p{N}/]/u;
/** The rest of a line after a leader in a table of contents ("Intro ... 12"). */
const PAGE_NUMBER_LINE = /^\s*\p{N}+\s*(?:\n|$)/u;
/** A word holding a scheme or a slash around the dots is an address (https://example.com/a...b). */
const ADDRESS_WORD = /:\/\/|\//u;

const wordAround = (text: string, start: number, end: number): string => {
  const from = text.slice(0, start).search(/\S*$/u);
  const to = end + (text.slice(end).match(/^\S*/u)?.[0].length ?? 0);
  return text.slice(from, to);
};

/** Dots that are not an ellipsis in running text: a range, a path or address, a table of contents leader. */
const isNotProse = (text: string, start: number, end: number): boolean =>
  NOT_PROSE_BESIDE.test(text.charAt(start - 1)) ||
  NOT_PROSE_BESIDE.test(text.charAt(end)) ||
  PAGE_NUMBER_LINE.test(text.slice(end)) ||
  ADDRESS_WORD.test(wordAround(text, start, end));

/** The ellipses in a text, matched longest form first, standing alone (not part of a longer run of dots). */
export const ellipsesIn = (text: string, forms: readonly string[]): WrittenEllipsis[] => {
  if (forms.length === 0) return [];
  const alternatives = forms
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  const pattern = new RegExp(`(?<!${ELLIPSIS_PART})(?:${alternatives})(?!${ELLIPSIS_PART})`, "gu");
  return [...text.matchAll(pattern)].flatMap((match) =>
    isNotProse(text, match.index, match.index + match[0].length) ? [] : [{ offset: match.index, form: match[0] }],
  );
};

export const ellipsisConsistency: Detector = (doc, options): Finding[] => {
  const text = doc.prose ?? doc.source;
  const ellipses = ellipsesIn(
    text,
    (doc.lexicons["ellipsis"] ?? []).map((entry) => entry.pattern),
  );
  const minority = formMinority(ellipses, options.limit);
  if (minority === undefined) return [];
  return minority.odd.map((ellipsis) => ({
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAround(text, ellipsis.offset, ellipsis.offset + ellipsis.form.length),
    values: { written: ellipsis.form, usual: minority.usual.form, count: minority.odd.length, of: ellipses.length, offset: ellipsis.offset },
  }));
};
