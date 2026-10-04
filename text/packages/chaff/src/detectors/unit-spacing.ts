import type { Detector, Finding } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { formMinority } from "./form-minority.ts";
import { quoteAround } from "./quote-around.ts";

// One document writing a number and a unit symbol both with a space between them ("5 GB") and without ("5GB"). Neither is
// called right; per unit, the less common way is reported. The symbols come from each language's lexicon "unit-symbol".

/** A number and its unit as written. form is "spaced" or "touching". */
export type WrittenQuantity = { readonly offset: number; readonly written: string; readonly unit: string; readonly form: string };

/** The less common way for one unit, with an example of the usual way and how many quantities of that unit there are. */
export type UnitMinority = { readonly odd: WrittenQuantity; readonly usual: string; readonly count: number; readonly of: number };

// Grouping commas, then at most one decimal point: 1.2.3 is a version, not a number.
const NUMBER = "[0-9]+(?:,[0-9]{3})*(?:\\.[0-9]+)?";
// A plain space, a no-break space or a narrow no-break space (the SI brochure's thin space between number and unit).
const GAP = "[ \\u00A0\\u202F]?";

/**
 * Numbers followed by a unit symbol, at most one space between. The number must not be part of a word, a version or an
 * address (v1.2GB, x86, 1.2.3GB), nor follow a hyphen: "10-8 cm" is as often a lost exponent as a range (5–10 GB, with
 * an en dash, is read). The symbol must not run on into a word, a rate or a file name (5 GBit, 5 GB/s, 5GB.zip).
 */
export const quantitiesIn = (text: string, symbols: readonly string[]): WrittenQuantity[] => {
  if (symbols.length === 0) return [];
  const units = symbols
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  const pattern = new RegExp(`(?<![A-Za-z0-9_.,/:#-])${NUMBER}(?<gap>${GAP})(?<unit>${units})(?![A-Za-z0-9_/]|\\.[A-Za-z0-9_])`, "gu");
  return [...text.matchAll(pattern)].map((match) => ({
    offset: match.index,
    written: match[0],
    unit: match.groups?.["unit"] ?? "",
    form: match.groups?.["gap"] === "" ? "touching" : "spaced",
  }));
};

const minorityOf = (ofUnit: readonly WrittenQuantity[], limit: number): UnitMinority[] => {
  const minority = formMinority(ofUnit, limit);
  if (minority === undefined) return [];
  return minority.odd.map((quantity) => ({ odd: quantity, usual: minority.usual.written, count: minority.odd.length, of: ofUnit.length }));
};

/** Per unit, the quantities written the less common way. "5 GB" and "500ms" in one document are two units, each consistent. */
export const unitMinorities = (quantities: readonly WrittenQuantity[], limit: number): UnitMinority[] =>
  [...new Set(quantities.map((quantity) => quantity.unit))]
    .flatMap((unit) =>
      minorityOf(
        quantities.filter((quantity) => quantity.unit === unit),
        limit,
      ),
    )
    .toSorted((left, right) => left.odd.offset - right.odd.offset);

export const unitSpacing: Detector = (doc, options): Finding[] => {
  const text = doc.prose ?? doc.source;
  const quantities = quantitiesIn(
    text,
    (doc.lexicons["unit-symbol"] ?? []).map((entry) => entry.pattern),
  );
  return unitMinorities(quantities, options.limit).map(({ odd, usual, count, of }) => ({
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAround(text, odd.offset, odd.offset + odd.written.length),
    values: { written: odd.written, usual, count, of, offset: odd.offset },
  }));
};
