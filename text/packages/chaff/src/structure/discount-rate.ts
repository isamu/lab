// discount-rate-mismatch: a volume-tier price list whose discount is not what its tier price and its list price give (list
// 8.0円 a sheet, 7.2円 at 1,000 sheets is 10% off, and the row says 15%). The list price is a column of the table, else the
// one price the document states as the list price: a sentence (「定価は1枚8.0円」, "The list price is $0.080 per envelope")
// or a row (| 定価 | 8.0円 |). Pure.
import type { StructureIssue } from "./issues.ts";
import { holds, plain, valueIn, type ChangeTable, type TableCell } from "./change-rate-table.ts";
import { bodyRows, offsetOf, sameUnit } from "./order-quantity.ts";
import { escapeRegExp } from "../orthography.ts";

/** rate: the discount column. price: the price after the discount. list: the list price. not: a rate that is no discount (tax). per: a unit mark. */
export type DiscountRole = "rate" | "price" | "list" | "not" | "per";
export type DiscountWord = { readonly pattern: string; readonly role: DiscountRole };
/** A line outside tables and the amounts of money written in it, each at its offset in the line. */
export type MoneyLine = { readonly text: string; readonly amounts: readonly { readonly offset: number; readonly written: string }[] };
export type DiscountText = { readonly tables: readonly ChangeTable[]; readonly lines: readonly MoneyLine[] };

type Price = { readonly value: number; readonly marks: string; readonly unit: string | undefined; readonly text: string };
type StatedRate = { readonly value: number; readonly decimals: number; readonly written: string };
type Columns = {
  readonly rate: number;
  readonly price: number;
  readonly list: number | undefined;
  readonly priceUnit: string | undefined;
  readonly listUnit: string | undefined;
};

/** A discount written 10%, 12.5 %, -10%, △10%, or in tenths 1割 / 1割5分 (15%). */
const PERCENT_RATE = /^[-−▲△]?\s*(\d{1,3})(?:\.(\d+))?\s*%$/u;
const TENTHS_RATE = /^([1-9])割(?:([1-9])分)?$/u;
const TENTH = 10;
const HUNDRED = 100;
const DECIMAL_BASE = 10;
/** A unit after its mark: 枚 in 1枚, envelope in "per envelope", box in /box. Hiragana ends it (1枚の単価, 1枚あたり). */
const UNIT_WORD = /^\s*([\p{Script=Han}\p{Script=Katakana}\p{Script=Latin}ー]+)/u;
const DIGIT_BEFORE = /[\d.,]$/u;
/** What may stand between a list-price word and its amount once a unit is out: 「定価は1枚8.0円」, "List price: $0.080", "is". */
const GAP_MARKS = /[\s:：=、,（()）*_.]/gu;
const GAP_WORDS: readonly string[] = ["あたり", "当たり", "につき", "税抜き", "税抜", "税込み", "税込", "税別", "は", "が", "の"];
const GAP_LATIN = /^(?:is|was|of|at|each|excl|excluding|incl|including|tax)$/u;
/** A sentence ends at 。 or at a full stop before a space or the line's end ($0.080 is one amount). */
const SENTENCE_END = /。|\.(?=\s|$)/u;
/** A unit after the amount belongs to it up to the next comma: "$0.080 per envelope, excluding tax". */
const CLAUSE_END = /[,、，]/u;
const KEY_VALUE_CELLS = 2;
const ROLE_ORDER: readonly DiscountRole[] = ["list", "price"];

const wordsOf = (words: readonly DiscountWord[], role: DiscountRole): string[] => words.filter((word) => word.role === role).map((word) => word.pattern);

const LATIN_END = /[a-z]$/u;

/** A word as it stands in a lowercased text: a Latin word whole (per is not in "upper"), anything else as written. */
const wordPattern = (word: string): string => {
  const written = escapeRegExp(plain(word).toLowerCase());
  return LATIN_END.test(word.toLowerCase()) ? `(?<![a-z0-9])${written}(?![a-z0-9])` : written;
};

/**
 * A discount column heading holds a rate word outside its price words (割引 is not read in 割引後の単価) and no not word;
 * else it is a list price, then a price.
 */
const roleOf = (heading: string, words: readonly DiscountWord[]): DiscountRole | undefined => {
  const key = plain(heading).toLowerCase();
  const held = (role: DiscountRole, text = key): boolean => wordsOf(words, role).some((word) => holds(text, word));
  const outsidePrices = wordsOf(words, "price").reduce((left, word) => left.replace(new RegExp(wordPattern(word), "gu"), " "), key);
  if (held("rate", outsidePrices)) return held("not") ? "not" : "rate";
  return ROLE_ORDER.find((role) => held(role));
};

/** The discount as written: 10%, 1割5分. Undefined for anything else and for 100% and more. */
export const discountIn = (text: string): StatedRate | undefined => {
  const written = plain(text);
  const percent = PERCENT_RATE.exec(written);
  const tenths = TENTHS_RATE.exec(written);
  if (percent !== null) {
    const value = Number(`${percent[1] ?? ""}.${percent[2] ?? "0"}`);
    return value < HUNDRED ? { value, decimals: percent[2]?.length ?? 0, written } : undefined;
  }
  if (tenths === null) return undefined;
  const value = Number(tenths[1]) * TENTH + Number(tenths[2] ?? 0);
  return { value, decimals: 0, written };
};

/** Each unit after a per mark that is not part of a number (1枚, not the 1 of 10枚): where it starts, where it ends, and the unit. */
const unitsIn = (text: string, words: readonly DiscountWord[]): { readonly start: number; readonly end: number; readonly unit: string }[] => {
  const key = text.toLowerCase();
  return wordsOf(words, "per").flatMap((mark) =>
    [...key.matchAll(new RegExp(wordPattern(mark), "gu"))].flatMap((match) => {
      const after = match.index + match[0].length;
      const unit = UNIT_WORD.exec(key.slice(after));
      if (unit?.[1] === undefined || DIGIT_BEFORE.test(key.slice(0, match.index))) return [];
      return [{ start: match.index, end: after + unit[0].length, unit: unit[1] }];
    }),
  );
};

/** The one unit a price is of (1枚, "per envelope", 円/枚); undefined when none or two. */
export const unitOf = (text: string, words: readonly DiscountWord[]): string | undefined => {
  const units = [...new Set(unitsIn(text, words).map((found) => found.unit))];
  return units.length === 1 ? units[0] : undefined;
};

const priceIn = (text: string, unit: string | undefined): Price | undefined => {
  const value = valueIn(text);
  return value === undefined || value.value <= 0 ? undefined : { value: value.value, marks: value.marks, unit, text: plain(text) };
};

/** Only marks and filler words: 「は」, ": ", " is ", " (excl. tax): ". */
const isGap = (text: string): boolean =>
  text
    .toLowerCase()
    .split(GAP_MARKS)
    .every((part) => part === "" || GAP_LATIN.test(part) || GAP_WORDS.reduce((left, word) => left.replaceAll(word, ""), part) === "");

const withoutUnits = (text: string, words: readonly DiscountWord[]): string =>
  unitsIn(text, words)
    .toSorted((left, right) => right.start - left.start)
    .reduce((left, found) => left.slice(0, found.start) + left.slice(found.end), text);

/** Each price a line states as the list price: the amount right after a list word, with only fillers and a unit between. */
const sentencePrices = (line: MoneyLine, words: readonly DiscountWord[]): Price[] => {
  const key = line.text.toLowerCase();
  return wordsOf(words, "list").flatMap((word) =>
    [...key.matchAll(new RegExp(wordPattern(word), "gu"))].flatMap((match) => {
      const from = match.index + match[0].length;
      const amount = line.amounts.find((found) => found.offset >= from);
      if (amount === undefined) return [];
      const gap = line.text.slice(from, amount.offset);
      if (!isGap(withoutUnits(gap, words))) return [];
      const rest = line.text.slice(amount.offset + amount.written.length).split(SENTENCE_END)[0] ?? "";
      const price = priceIn(amount.written, unitOf(gap, words) ?? unitOf(rest.split(CLAUSE_END)[0] ?? "", words));
      return price === undefined ? [] : [price];
    }),
  );
};

/** A table row that is a list price: its first cell holds a list word; the price is the price column's cell, or a two-cell row's second. */
const rowPrice = (row: readonly TableCell[], words: readonly DiscountWord[], priceColumn: number | undefined, unit: string | undefined): Price[] => {
  const [label] = row;
  if (label === undefined || roleOf(label.text, words) !== "list") return [];
  const keyValue = row.length === KEY_VALUE_CELLS ? row[1] : undefined;
  const cell = priceColumn === undefined ? keyValue : row[priceColumn];
  const price = cell === undefined ? undefined : priceIn(cell.text, unitOf(label.text, words) ?? unit);
  return price === undefined ? [] : [price];
};

const onlyIndex = (indexes: readonly number[]): number | undefined => (indexes.length === 1 ? indexes[0] : undefined);

const columnsOf = (table: ChangeTable, words: readonly DiscountWord[]): Columns | undefined => {
  const roles = table.header.map((cell) => roleOf(cell.text, words));
  const at = (role: DiscountRole): number[] => roles.flatMap((found, index) => (found === role ? [index] : []));
  const [rate, price, lists] = [onlyIndex(at("rate")), onlyIndex(at("price")), at("list")];
  if (rate === undefined || price === undefined || lists.length > 1) return undefined;
  const list = lists[0];
  const [priceUnit, listUnit] = [
    unitOf(table.header[price]?.text ?? "", words),
    list === undefined ? undefined : unitOf(table.header[list]?.text ?? "", words),
  ];
  return { rate, price, list, priceUnit, listUnit };
};

/** The one list price the document states in a sentence or a table row; undefined when none, or two different ones. */
const statedListPrice = (text: DiscountText, words: readonly DiscountWord[]): Price | undefined => {
  const fromTables = text.tables.flatMap((table) => {
    const columns = columnsOf(table, words);
    return bodyRows(table).flatMap((row) => rowPrice(row, words, columns?.price, columns?.priceUnit));
  });
  const prices = [...text.lines.flatMap((line) => sentencePrices(line, words)), ...fromTables];
  const distinct = new Set(prices.map((price) => `${String(price.value)}|${price.marks}|${price.unit ?? ""}`));
  return distinct.size === 1 ? prices[0] : undefined;
};

/** Whether the stated rate is the discount within its own rounding, or the tier price is the list less the rate within the price's. */
export const discountMatches = (list: number, tier: number, stated: number, decimals: number, tierStep: number): boolean => {
  const computed = (1 - tier / list) * HUNDRED;
  const rateStep = DECIMAL_BASE ** -decimals;
  const epsilon = 1e-9;
  return Math.abs(computed - stated) < rateStep - epsilon || Math.abs(list * (1 - stated / HUNDRED) - tier) < tierStep - epsilon;
};

/** The row's list price: its list column's cell, else the stated one; undefined when its unit is not the tier price's. */
const listPriceOf = (row: readonly TableCell[], columns: Columns, stated: Price | undefined): Price | undefined => {
  const listCell = columns.list === undefined ? undefined : row[columns.list];
  const list = listCell === undefined ? stated : priceIn(listCell.text, columns.listUnit);
  const otherUnit = list?.unit !== undefined && columns.priceUnit !== undefined && !sameUnit(list.unit, columns.priceUnit);
  return otherUnit ? undefined : list;
};

const rowIssue = (row: readonly TableCell[], columns: Columns, stated: Price | undefined): StructureIssue[] => {
  const [rateCell, priceCell] = [row[columns.rate], row[columns.price]];
  const list = listPriceOf(row, columns, stated);
  const rate = rateCell === undefined ? undefined : discountIn(rateCell.text);
  const tier = priceCell === undefined ? undefined : valueIn(priceCell.text);
  if (rateCell === undefined || list === undefined || rate === undefined || tier === undefined || tier.marks !== list.marks) return [];
  // A price not below the list price is no tier price: an invoice's price before its discount, another unit, a surcharge.
  if (tier.value >= list.value || discountMatches(list.value, tier.value, rate.value, rate.decimals, tier.step)) return [];
  const computed = ((1 - tier.value / list.value) * HUNDRED).toFixed(rate.decimals);
  const values = { written: rate.written, expected: `${computed}%`, list: list.text, price: plain(priceCell?.text ?? "") };
  return [{ offset: offsetOf(rateCell), values }];
};

/** Each discount in a tier table that its row's price and the list price do not give. */
export const discountRateMismatches = (text: DiscountText, words: readonly DiscountWord[]): StructureIssue[] => {
  if (words.length === 0) return [];
  const stated = statedListPrice(text, words);
  return text.tables.flatMap((table) => {
    const columns = columnsOf(table, words);
    return columns === undefined ? [] : bodyRows(table).flatMap((row) => rowIssue(row, columns, stated));
  });
};
