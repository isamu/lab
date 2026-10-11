// net-over-gross: one row of a weight table (a packing list) with the net weight (the goods alone) and the gross weight
// (with the packing), each in a column its heading words name. Pure.
import type { StructureIssue } from "./issues.ts";
import { holds, plain, valueIn, type ChangeTable, type TableCell } from "./change-rate-table.ts";
import { bodyRows, offsetOf, sameUnit } from "./order-quantity.ts";
import { escapeRegExp } from "../orthography.ts";

export type WeightRole = "net" | "gross";
export type WeightWord = { readonly pattern: string; readonly role: WeightRole };
export type MassUnit = { readonly pattern: string; readonly factor: number };
/** The heading words of each column, the words after a number that make it no exact weight (以上, "or more"), and the mass units. */
export type WeightWords = { readonly columns: readonly WeightWord[]; readonly qualifiers: readonly string[]; readonly units: readonly MassUnit[] };
export type WeightColumns = { readonly net: number; readonly gross: number };

const ROLES: readonly WeightRole[] = ["net", "gross"];
const LATIN = /[a-z]/u;
/** Spaces and punctuation: "Net wt." beside "Gross weight", 「正味重量（kg）」 beside "総重量 (kg)" say the same besides. */
const SPACES_AND_MARKS = /[\s\p{P}]+/gu;
/** Converted weights are compared to this many decimal places, so 0.1 kg and 100 g are one weight. */
const COMPARE_DECIMALS = 6;

const wordsHeld = (key: string, words: readonly WeightWord[], role: WeightRole): WeightWord[] =>
  words.filter((word) => word.role === role && holds(key, word.pattern));

const withoutWord = (key: string, word: string): string => {
  const written = plain(word).toLowerCase();
  if (!LATIN.test(written)) return key.replaceAll(written, "");
  return key.replace(new RegExp(`(?<![a-z0-9])${escapeRegExp(written)}(?![a-z0-9])`, "gu"), "");
};

type Heading = { readonly role: WeightRole; readonly rest: string };

/**
 * The role a heading names, and what it says besides ("(kg)", "per carton"). A heading naming both ("Net / Gross weight")
 * keeps the other role's word besides, so it never pairs with a heading of the other role.
 */
const headingOf = (heading: string, words: readonly WeightWord[]): Heading | undefined => {
  const key = plain(heading).toLowerCase();
  const role = ROLES.find((candidate) => wordsHeld(key, words, candidate).length > 0);
  if (role === undefined) return undefined;
  const rest = wordsHeld(key, words, role).reduce((left, word) => withoutWord(left, word.pattern), key);
  return { role, rest: rest.replace(SPACES_AND_MARKS, "") };
};

/**
 * The one net and the one gross column. A table with two of either, or whose two headings say different things besides
 * net and gross ("Net weight per piece" beside "Gross weight per carton"), is not read.
 */
export const weightColumnsOf = (headings: readonly string[], words: readonly WeightWord[]): WeightColumns | undefined => {
  const read = headings.map((heading) => headingOf(heading, words));
  const all = (role: WeightRole): number[] => read.flatMap((found, index) => (found?.role === role ? [index] : []));
  const [net, gross] = [all("net"), all("gross")];
  const [netIndex, grossIndex] = [net[0], gross[0]];
  if (net.length !== 1 || gross.length !== 1 || netIndex === undefined || grossIndex === undefined) return undefined;
  const [netHeading, grossHeading] = [read[netIndex], read[grossIndex]];
  if (netHeading === undefined || grossHeading === undefined || netHeading.rest !== grossHeading.rest) return undefined;
  return { net: netIndex, gross: grossIndex };
};

type Weight = { readonly value: number; readonly unit: string; readonly cell: TableCell };

/** A plain weight: a number with what is written after it (kg), no sign, bracket or word before it, and no bound after it. */
const weightIn = (cell: TableCell | undefined, qualifiers: readonly string[]): Weight | undefined => {
  const value = cell === undefined ? undefined : valueIn(cell.text);
  if (cell === undefined || value === undefined) return undefined;
  const [before = "", after = ""] = value.marks.split("|");
  const unit = after.toLowerCase();
  if (before !== "" || qualifiers.some((word) => holds(unit, word))) return undefined;
  return { value: value.value, unit, cell };
};

const factorOf = (unit: string, units: readonly MassUnit[]): number | undefined => units.find((known) => known.pattern.toLowerCase() === unit)?.factor;

const rounded = (value: number): number => Number(value.toFixed(COMPARE_DECIMALS));

/** Net larger than gross: in one unit as written, or both converted by the mass units (g, kg, t). Undefined when they cannot be compared. */
const netExceeds = (net: Weight, gross: Weight, units: readonly MassUnit[]): boolean | undefined => {
  if (sameUnit(net.unit, gross.unit)) return net.value > gross.value;
  const [netFactor, grossFactor] = [factorOf(net.unit, units), factorOf(gross.unit, units)];
  if (netFactor === undefined || grossFactor === undefined) return undefined;
  return rounded(net.value * netFactor) > rounded(gross.value * grossFactor);
};

/** Each row (the totals row too) whose net weight is larger than its gross weight. */
export const netOverGross = (tables: readonly ChangeTable[], words: WeightWords): StructureIssue[] =>
  tables.flatMap((table) => {
    const columns = weightColumnsOf(
      table.header.map((cell) => cell.text),
      words.columns,
    );
    if (columns === undefined) return [];
    return bodyRows(table).flatMap((row) => {
      const [net, gross] = [weightIn(row[columns.net], words.qualifiers), weightIn(row[columns.gross], words.qualifiers)];
      if (net === undefined || gross === undefined || netExceeds(net, gross, words.units) !== true) return [];
      return [{ offset: offsetOf(net.cell), values: { net: plain(net.cell.text), gross: plain(gross.cell.text) } }];
    });
  });
