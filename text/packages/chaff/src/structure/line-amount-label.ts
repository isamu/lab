import type { StructureIssue } from "./issues.ts";
import { linesOf, type Line } from "./lines.ts";
import { escapeRegExp } from "../orthography.ts";
import { roundedMatches } from "./tax.ts";
import { hasSuperscriptPower } from "../facts/superscript-power.ts";
import { cellNumber, cellsOf, plain, shownExpected, tablesOf, type Cell, type CellNumber } from "./line-amount.ts";

/**
 * line-amount-mismatch, the product written in an item cell: 「| 会費（3,000円×24名） | 72,000円 |」,
 * "| Membership dues (24 members × $40) | $960.00 |". The bracket must be exactly one price and one count joined by one
 * times mark, in either order: the price one amount of money, the count a whole number in a counting word. The row must
 * hold that one amount besides the item cell, written with the price's marks. A bracket with two marks, a %, or factors
 * that are not one price and one count, and a row with a second number, are not read. Pure.
 */
export type LabelProductWords = {
  /** Marks that multiply (×); one in letters (x) counts only between spaces. */
  readonly times: readonly string[];
  /** Words a count multiplied by a price counts (名, members). */
  readonly counts: readonly string[];
  /** Whether a text is one amount of money and nothing else (currency-notation). */
  readonly isMoney: (text: string) => boolean;
};

type LabelProduct = { readonly price: CellNumber; readonly count: number; readonly countWritten: string };

const CENTS = 100;
const BRACKETED = /\(([^()]*)\)/gu;
const COUNT = /^(\d{1,3}(?:,\d{3})+|\d+)\s*(\S.*)$/u;
const LATIN = /[A-Za-z]/u;

const timesPattern = (marks: readonly string[]): RegExp | undefined =>
  marks.length === 0
    ? undefined
    : new RegExp(marks.map((mark) => (LATIN.test(mark) ? `(?<=\\s)${escapeRegExp(mark)}(?=\\s)` : escapeRegExp(mark))).join("|"), "gu");

/** The bracket split at its one times mark, undefined when it holds none, more, or a %. */
export const factorsOf = (content: string, marks: readonly string[]): [string, string] | undefined => {
  const pattern = timesPattern(marks);
  if (pattern === undefined || content.includes("%")) return undefined;
  const found = [...content.matchAll(pattern)];
  const [only] = found;
  if (found.length !== 1 || only === undefined) return undefined;
  return [content.slice(0, only.index).trim(), content.slice(only.index + only[0].length).trim()];
};

/** A whole count in a counting word ("24名", "24 members"), undefined for anything else. */
export const countOf = (factor: string, counts: readonly string[]): number | undefined => {
  const match = COUNT.exec(factor);
  const word = match?.[2]?.trim().toLowerCase();
  if (match === null || word === undefined || !counts.some((count) => count.toLowerCase() === word)) return undefined;
  return Number((match[1] ?? "").replaceAll(",", ""));
};

const priceOf = (factor: string, words: LabelProductWords): CellNumber | undefined =>
  words.isMoney(factor) ? cellNumber({ start: 0, text: factor }) : undefined;

const productOf = (factors: readonly [string, string], words: LabelProductWords): LabelProduct | undefined => {
  const orders: readonly (readonly [string, string])[] = [factors, [factors[1], factors[0]]];
  const readings = orders.flatMap(([priceText, countText]) => {
    const [price, count] = [priceOf(priceText, words), countOf(countText, words.counts)];
    return price === undefined || count === undefined ? [] : [{ price, count, countWritten: countText }];
  });
  return readings.length === 1 ? readings[0] : undefined;
};

/** The one product written in brackets in the item cell, undefined when there is none, more than one, or a footnote mark NFKC would join to a number (24¹). */
export const labelProductOf = (label: string, words: LabelProductWords): LabelProduct | undefined => {
  if (hasSuperscriptPower(label)) return undefined;
  const products = [...plain(label).matchAll(BRACKETED)].flatMap((match) => {
    const factors = factorsOf(match[1] ?? "", words.times);
    const product = factors === undefined ? undefined : productOf(factors, words);
    return product === undefined ? [] : [product];
  });
  return products.length === 1 ? products[0] : undefined;
};

/** The row's one amount besides the item cell, undefined when no other cell or more than one holds a number. */
const amountOf = (cells: readonly Cell[], words: LabelProductWords): CellNumber | undefined => {
  const numbered = cells.slice(1).filter((cell) => /\d/u.test(plain(cell.text)));
  const [only] = numbered;
  if (numbered.length !== 1 || only === undefined || !words.isMoney(plain(only.text))) return undefined;
  return cellNumber(only);
};

const rowIssue = (row: Line, words: LabelProductWords): StructureIssue[] => {
  const cells = cellsOf(row);
  const [label] = cells;
  const product = label === undefined ? undefined : labelProductOf(label.text, words);
  const amount = product === undefined ? undefined : amountOf(cells, words);
  if (product === undefined || amount === undefined) return [];
  const { price, count, countWritten } = product;
  if (price.before !== amount.before || price.after !== amount.after) return [];
  const exactCents = count * price.value * CENTS;
  if (roundedMatches(Math.round(amount.value * CENTS), exactCents, amount.decimals === 0)) return [];
  const values = { written: amount.written, quantity: countWritten, price: price.written, expected: shownExpected(amount, exactCents) };
  return [{ offset: amount.offset, values }];
};

export const labelProductMismatches = (source: string, words: LabelProductWords): StructureIssue[] =>
  tablesOf(linesOf(source)).flatMap(({ rows }) => rows.flatMap((row) => rowIssue(row, words)));
