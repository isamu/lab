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

/** The ellipses in a text, matched longest form first, standing alone (not part of a longer run of dots). */
export const ellipsesIn = (text: string, forms: readonly string[]): WrittenEllipsis[] => {
  if (forms.length === 0) return [];
  const alternatives = forms
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  const pattern = new RegExp(`(?<!${ELLIPSIS_PART})(?:${alternatives})(?!${ELLIPSIS_PART})`, "gu");
  return [...text.matchAll(pattern)].map((match) => ({ offset: match.index, form: match[0] }));
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
