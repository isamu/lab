// currency-column-mix: one column of amounts with a single cell in another currency (USD 45 among 円 amounts). Which
// currency an amount is in, and which heading words make a table one that converts or lists currencies, come from the
// language packages. Pure.
import type { StructureIssue } from "./issues.ts";
import { holds, plain, type ChangeTable, type TableCell } from "./change-rate-table.ts";
import { bodyRows, offsetOf } from "./order-quantity.ts";

/** A way of writing a currency (円, ¥, USD, ドル) and the currency it means (JPY, USD). */
export type CurrencyWord = { readonly pattern: string; readonly currency: string };

export type CurrencyColumnWords = {
  /** The currency marks, to read which currencies a heading or a row label names. */
  readonly currencies: readonly CurrencyWord[];
  /** Heading words of a column that says the currency or the exchange rate (通貨, Currency, 為替, exchange rate). */
  readonly columns: readonly string[];
  /** The currencies of the amounts written in a cell's text (USD 45 → USD). */
  readonly amountCurrencies: (text: string) => readonly string[];
};

/** The majority currency must stand in at least this many cells of the column. */
const MIN_MAJORITY = 2;
/** A column holds two currencies: the one most cells are in and the one odd cell's. */
const CURRENCIES_IN_MIX = 2;

const namedCurrencies = (text: string, words: readonly CurrencyWord[]): Set<string> => {
  const key = plain(text).toLowerCase();
  return new Set(words.filter((word) => holds(key, word.pattern)).map((word) => word.currency));
};

const BRACKETED = /[(（]([^()（）]*)[)）]/gu;

/** The currencies a row label names in brackets (送金手数料（USD）); 円 in a word (円滑化) names none. */
const bracketedCurrencies = (label: string, words: readonly CurrencyWord[]): Set<string> =>
  new Set([...label.matchAll(BRACKETED)].flatMap((match) => [...namedCurrencies(match[1] ?? "", words)]));

type Priced = { readonly cell: TableCell; readonly label: string; readonly currency: string };

/** The cells of one column with an amount in exactly one currency; undefined when a cell gives two (¥12,500 (USD 85)). */
const pricedCells = (rows: readonly (readonly TableCell[])[], column: number, words: CurrencyColumnWords): Priced[] | undefined => {
  const read = rows.flatMap((row) => {
    const cell = row[column];
    if (cell === undefined) return [];
    const currencies = [...new Set(words.amountCurrencies(cell.text))];
    return currencies.length === 0 ? [] : [{ cell, label: plain(row[0]?.text ?? ""), currencies }];
  });
  if (read.some((entry) => entry.currencies.length > 1)) return undefined;
  return read.flatMap(({ cell, label, currencies: [currency] }) => (currency === undefined ? [] : [{ cell, label, currency }]));
};

const countsOf = (cells: readonly Priced[]): Map<string, number> =>
  cells.reduce((counts, { currency }) => counts.set(currency, (counts.get(currency) ?? 0) + 1), new Map<string, number>());

/**
 * The one cell whose currency differs from the rest: the column holds two currencies, the majority in at least two cells
 * and the other in exactly one. A row whose label names the odd currency (送金手数料（USD）) says so itself.
 */
const oddCell = (cells: readonly Priced[], words: CurrencyColumnWords): { odd: Priced; usual: Priced } | undefined => {
  const counts = [...countsOf(cells).entries()].toSorted((left, right) => right[1] - left[1]);
  const [major, minor] = counts;
  if (counts.length !== CURRENCIES_IN_MIX || major === undefined || minor === undefined) return undefined;
  if (major[1] < MIN_MAJORITY || minor[1] !== 1) return undefined;
  const odd = cells.find((cell) => cell.currency === minor[0]);
  const usual = cells.find((cell) => cell.currency === major[0]);
  if (odd === undefined || usual === undefined || bracketedCurrencies(odd.label, words.currencies).has(odd.currency)) return undefined;
  return { odd, usual };
};

const columnIssue = (table: ChangeTable, column: number, words: CurrencyColumnWords): StructureIssue[] => {
  const heading = table.header[column]?.text ?? "";
  if (namedCurrencies(heading, words.currencies).size >= CURRENCIES_IN_MIX) return [];
  const cells = pricedCells(bodyRows(table), column, words);
  const found = cells === undefined ? undefined : oddCell(cells, words);
  if (found === undefined) return [];
  const { odd, usual } = found;
  return [
    {
      offset: offsetOf(odd.cell),
      values: { item: odd.label, written: plain(odd.cell.text), usual: plain(usual.cell.text), currency: odd.currency, majority: usual.currency },
    },
  ];
};

const listsCurrencies = (table: ChangeTable, columns: readonly string[]): boolean =>
  table.header.some((cell) => {
    const key = plain(cell.text).toLowerCase();
    return columns.some((word) => holds(key, word));
  });

/**
 * Each column of amounts with one cell in another currency than the rest. A table with a column of currencies or of exchange
 * rates converts on purpose, and a column whose heading names two currencies (金額（円/USD）) holds both on purpose.
 */
export const currencyColumnMix = (tables: readonly ChangeTable[], words: CurrencyColumnWords): StructureIssue[] =>
  tables.flatMap((table) => {
    if (listsCurrencies(table, words.columns)) return [];
    return table.header.flatMap((_, column) => columnIssue(table, column, words));
  });
