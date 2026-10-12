// tax-mismatch in a price list: one row's tax-included price that is not its tax-excluded price plus the rate. The two
// columns are the ones whose headings are the same apart from the excluded / included words and a rate (「1箱の価格（税抜）」,
// 「1箱の価格（税込・10%）」); the rate is the included heading's, else the one rate the document states beside a tax word. Pure.
import type { StructureIssue } from "./issues.ts";
import { holds, plain, valueIn, type ChangeTable, type TableCell } from "./change-rate-table.ts";
import { withoutWord } from "./net-gross-weight.ts";
import { bodyRows, offsetOf } from "./order-quantity.ts";
import { roundedMatches } from "./tax.ts";

/** excluded: a price before tax. included: a price with tax. rate: a word beside which a rate in a sentence is the tax rate. */
export type TaxPriceRole = "excluded" | "included" | "rate";
export type TaxPriceWord = { readonly pattern: string; readonly role: TaxPriceRole };
/** The document's tables and its lines outside tables. */
export type TaxPriceText = { readonly tables: readonly ChangeTable[]; readonly lines: readonly string[] };
export type TaxPricePair = { readonly excluded: number; readonly included: number; readonly rate: number | undefined };

const RATE = /(\d{1,2}(?:\.\d{1,2})?)[ \t]?%/gu;
const MAX_RATE = 100;
const CENTS = 100;
const SPACES = /\s+/gu;
/** Spaces and punctuation: 「（税込・10%）」 and "(incl. 8% tax)" say nothing besides once the words are out; $ and € still do. */
const SPACES_AND_MARKS = /[\s\p{P}]+/gu;
/** What may stand between a tax word and its rate: 「消費税率は10%」, "sales tax of 8%", "VAT: 20%". */
const FILLER_MARKS: ReadonlySet<string> = new Set([":", "：", "=", "（", "(", "は", "が", "の"]);
const FILLER_WORDS: readonly string[] = [" of", " at", " is"];
const AFTER_RATE = /^[\s)）]+/u;
const NUMBER = /\d[\d,]*(?:\.\d+)?/u;
const LATIN_LETTER = /[a-z]/u;

const ratesIn = (text: string): number[] =>
  [...text.matchAll(RATE)].map((match) => Number(match[1])).filter((rate) => Number.isFinite(rate) && rate > 0 && rate < MAX_RATE);

type Heading = { readonly role: "excluded" | "included"; readonly rest: string; readonly rate: number | undefined };

const heldWords = (key: string, words: readonly TaxPriceWord[], role: TaxPriceRole): string[] =>
  words
    .filter((word) => word.role === role && holds(key, word.pattern))
    .map((word) => word.pattern)
    .toSorted((left, right) => right.length - left.length);

/** The role a heading names, what it says besides, and its one rate. A heading naming both roles is not read. */
const headingOf = (heading: string, words: readonly TaxPriceWord[]): Heading | undefined => {
  const key = plain(heading).toLowerCase();
  const rates = ratesIn(key);
  const withoutRate = key.replace(RATE, " ").replace(SPACES, " ");
  const [excluded, included] = [heldWords(withoutRate, words, "excluded"), heldWords(withoutRate, words, "included")];
  if (excluded.length > 0 === included.length > 0) return undefined;
  const role = excluded.length > 0 ? "excluded" : "included";
  const rest = [...excluded, ...included].reduce((left, word) => withoutWord(left, word), withoutRate);
  return { role, rest: rest.replace(SPACES_AND_MARKS, ""), rate: rates.length === 1 ? rates[0] : undefined };
};

/** Each included column with the one excluded column whose heading says the same besides, and the included heading's rate. */
export const taxPricePairsOf = (headings: readonly string[], words: readonly TaxPriceWord[]): TaxPricePair[] => {
  const read = headings.map((heading) => headingOf(heading, words));
  const columnsOf = (role: Heading["role"], rest: string): number[] =>
    read.flatMap((found, index) => (found?.role === role && found.rest === rest ? [index] : []));
  return read.flatMap((found, included) => {
    if (found?.role !== "included" || columnsOf("included", found.rest).length !== 1) return [];
    const [excluded, ...others] = columnsOf("excluded", found.rest);
    return excluded === undefined || others.length > 0 ? [] : [{ excluded, included, rate: found.rate }];
  });
};

const withoutFillers = (text: string): string => {
  const trimmed = text.trimEnd();
  const last = trimmed.at(-1);
  if (last !== undefined && FILLER_MARKS.has(last)) return withoutFillers(trimmed.slice(0, -1));
  const word = FILLER_WORDS.find((filler) => trimmed.endsWith(filler));
  return word === undefined ? trimmed : withoutFillers(trimmed.slice(0, -word.length));
};

const besideWord = (line: string, at: number, end: number, word: string): boolean => {
  const written = plain(word).toLowerCase();
  const before = withoutFillers(line.slice(0, at).toLowerCase());
  const after = line.slice(end).toLowerCase().replace(AFTER_RATE, "");
  const standsAlone = (next: string | undefined): boolean => !LATIN_LETTER.test(written) || next === undefined || !LATIN_LETTER.test(next);
  return (before.endsWith(written) && standsAlone(before.at(-written.length - 1))) || (after.startsWith(written) && standsAlone(after[written.length]));
};

/** The distinct rates the lines state right beside a rate word: 「消費税10%」, "8% sales tax", "tax rate of 8%". */
export const statedTaxRates = (lines: readonly string[], words: readonly TaxPriceWord[]): number[] => {
  const rateWords = words.filter((word) => word.role === "rate").map((word) => word.pattern);
  const rates = lines.flatMap((written) => {
    const line = plain(written);
    return [...line.matchAll(RATE)].flatMap((match) => {
      const end = match.index + match[0].length;
      return rateWords.some((word) => besideWord(line, match.index, end, word)) ? ratesIn(match[0]) : [];
    });
  });
  return [...new Set(rates)];
};

/** The tax-included price as the cell writes it: its unit, its grouping and its decimals. */
const shownLike = (written: string, exactCents: number, decimals: number): string => {
  const number = (Math.round(exactCents) / CENTS).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: written.includes(","),
  });
  return written.replace(NUMBER, number);
};

const decimalsOf = (text: string): number => NUMBER.exec(text)?.[0].split(".")[1]?.length ?? 0;

const rowIssue = (excludedCell: TableCell | undefined, includedCell: TableCell | undefined, rate: number): StructureIssue[] => {
  const [excluded, included] = [excludedCell && valueIn(excludedCell.text), includedCell && valueIn(includedCell.text)];
  if (includedCell === undefined || excluded === undefined || included === undefined || excluded.marks !== included.marks) return [];
  if (excluded.value <= 0) return [];
  // price × (100 + rate)% in cents is price × (100 + rate); the price is not rounded first ($0.335 at 10% is $0.3685).
  const exactCents = excluded.value * (CENTS + rate);
  if (roundedMatches(Math.round(included.value * CENTS), exactCents, included.step >= 1)) return [];
  const written = plain(includedCell.text);
  const values = { written, expected: shownLike(written, exactCents, decimalsOf(written)), rate: `${String(rate)}%`, base: plain(excludedCell?.text ?? "") };
  return [{ offset: offsetOf(includedCell), values }];
};

/**
 * Each row of a price list whose tax-included price is not its tax-excluded price plus the rate, rounded down, to nearest or
 * up. A pair is not read when the document states a rate other than its own (a reduced rate beside the standard one): which
 * items take which is not written in the columns.
 */
export const taxIncludedPriceMismatches = (text: TaxPriceText, words: readonly TaxPriceWord[]): StructureIssue[] => {
  if (words.length === 0) return [];
  const stated = statedTaxRates(text.lines, words);
  return text.tables.flatMap((table) =>
    taxPricePairsOf(
      table.header.map((cell) => cell.text),
      words,
    ).flatMap((pair) => {
      const rate = pair.rate ?? stated[0];
      if (rate === undefined || stated.some((other) => other !== rate)) return [];
      return bodyRows(table).flatMap((row) => rowIssue(row[pair.excluded], row[pair.included], rate));
    }),
  );
};
