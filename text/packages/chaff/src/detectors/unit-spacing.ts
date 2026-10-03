import type { Detector, Finding } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { formMinority } from "./form-minority.ts";
import { quoteAround } from "./quote-around.ts";

// One document writing a number and a unit symbol both with a space between them ("5 GB") and without ("5GB"). Neither is
// called right; the less common way is reported. The symbols come from each language's lexicon "unit-symbol".

/** A number and its unit as written. form is "spaced" or "touching". */
export type WrittenQuantity = { readonly offset: number; readonly written: string; readonly form: string };

const NUMBER = "[0-9]+(?:[.,][0-9]+)*";

/**
 * Numbers followed by a unit symbol, at most one plain space between. The number must not be part of a word, a version or
 * an address (v1.2GB, x86), and the symbol must not run on into a word (5 GBit is not read as GB).
 */
export const quantitiesIn = (text: string, symbols: readonly string[]): WrittenQuantity[] => {
  if (symbols.length === 0) return [];
  const units = symbols
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  const pattern = new RegExp(`(?<![A-Za-z0-9_.,/:#-])${NUMBER}(?<gap> ?)(?:${units})(?![A-Za-z0-9_])`, "gu");
  return [...text.matchAll(pattern)].map((match) => ({
    offset: match.index,
    written: match[0],
    form: match.groups?.["gap"] === " " ? "spaced" : "touching",
  }));
};

export const unitSpacing: Detector = (doc, options): Finding[] => {
  const text = doc.prose ?? doc.source;
  const quantities = quantitiesIn(
    text,
    (doc.lexicons["unit-symbol"] ?? []).map((entry) => entry.pattern),
  );
  const minority = formMinority(quantities, options.limit);
  if (minority === undefined) return [];
  return minority.odd.map((quantity) => ({
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAround(text, quantity.offset, quantity.offset + quantity.written.length),
    values: { written: quantity.written, usual: minority.usual.written, count: minority.odd.length, of: quantities.length, offset: quantity.offset },
  }));
};
