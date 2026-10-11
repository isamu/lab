// delivered-over-ordered and backorder-mismatch: one row of a quantity table (a delivery note, a backorder list) with the
// ordered, delivered and backordered quantities, each in a column its heading words name. Pure.
import type { StructureIssue } from "./issues.ts";
import { holds, plain, valueIn, type ChangeTable, type TableCell } from "./change-rate-table.ts";

export type QuantityRole = "ordered" | "delivered" | "backordered";
export type QuantityWord = { readonly pattern: string; readonly role: QuantityRole };
export type QuantityColumns = { readonly ordered: number; readonly delivered: number; readonly backordered?: number };
/** The heading words of each column, and the words after a number that make it no exact count (以上, "or more"). */
export type QuantityWords = { readonly columns: readonly QuantityWord[]; readonly qualifiers: readonly string[] };

/** Backordered first: 「発注残」 holds 発注 and 「未納品数」 holds 納品数, "Back ordered" holds "ordered", and both are what is left. */
const ROLE_ORDER: readonly QuantityRole[] = ["backordered", "delivered", "ordered"];

/** A heading that names both ordered and delivered ("Ordered / Delivered") says neither: it is no column to read. */
const BOTH = "both";

const roleOf = (heading: string, words: readonly QuantityWord[]): QuantityRole | typeof BOTH | undefined => {
  const key = plain(heading).toLowerCase();
  const named = ROLE_ORDER.filter((role) => words.some((word) => word.role === role && holds(key, word.pattern)));
  if (!named.includes("backordered") && named.includes("delivered") && named.includes("ordered")) return BOTH;
  return named[0];
};

/**
 * The one ordered and the one delivered column, and the one backordered column when there is one. Two delivered columns
 * (前回 and 今回, "Previously" and "Now") say neither alone what is left, so a table with two is not read.
 */
export const quantityColumnsOf = (headings: readonly string[], words: readonly QuantityWord[]): QuantityColumns | undefined => {
  const roles = headings.map((heading) => roleOf(heading, words));
  const all = (role: QuantityRole): number[] => roles.flatMap((found, index) => (found === role ? [index] : []));
  const [ordered, delivered, backordered] = [all("ordered"), all("delivered"), all("backordered")];
  if (roles.includes(BOTH) || ordered.length !== 1 || delivered.length !== 1 || backordered.length > 1) return undefined;
  const [orderedIndex = 0, deliveredIndex = 0] = [ordered[0], delivered[0]];
  return { ordered: orderedIndex, delivered: deliveredIndex, ...(backordered[0] === undefined ? {} : { backordered: backordered[0] }) };
};

type Count = { readonly value: number; readonly unit: string; readonly cell: TableCell };

/**
 * A plain count: a whole number with what is written after it (冊, boxes), no sign, bracket, decimals or mark before it,
 * and no word after it that makes it a bound or a guess (10以上, "12 or more").
 */
const countIn = (cell: TableCell | undefined, qualifiers: readonly string[]): Count | undefined => {
  const value = cell === undefined ? undefined : valueIn(cell.text);
  if (cell === undefined || value === undefined || value.step !== 1) return undefined;
  const [before = "", after = ""] = value.marks.split("|");
  const unit = after.toLowerCase();
  if (before !== "" || qualifiers.some((word) => holds(unit, word))) return undefined;
  return { value: value.value, unit, cell };
};

/** The plural forms of an English unit: "reams", "boxes", "copies". */
const pluralsOf = (unit: string): string[] => [
  `${unit}s`,
  ...(/(?:s|x|z|ch|sh|o)$/u.test(unit) ? [`${unit}es`] : []),
  ...(/[^aeiou]y$/u.test(unit) ? [`${unit.slice(0, -1)}ies`] : []),
];

/** One unit, written singular or plural: "box" and "boxes", "copy" and "copies". */
const sameUnit = (left: string, right: string): boolean => left === right || pluralsOf(left).includes(right) || pluralsOf(right).includes(left);

const offsetOf = (cell: TableCell): number => cell.start + (cell.text.length - cell.text.trimStart().length);

/** The counts of a row's columns, when every one is a count in one unit; undefined when any cell says something else. */
const countsOf = (row: readonly TableCell[], indexes: readonly number[], qualifiers: readonly string[]): Count[] | undefined => {
  const counts = indexes.map((index) => countIn(row[index], qualifiers));
  const read = counts.flatMap((count) => (count === undefined ? [] : [count]));
  const [first] = read;
  if (read.length !== indexes.length || first === undefined || !read.every((count) => sameUnit(count.unit, first.unit))) return undefined;
  return read;
};

const bodyRows = (table: ChangeTable): (readonly TableCell[])[] => table.rows.filter((row) => row.length === table.header.length);

const columnsOfTable = (table: ChangeTable, words: QuantityWords): QuantityColumns | undefined =>
  quantityColumnsOf(
    table.header.map((cell) => cell.text),
    words.columns,
  );

/** Each row whose delivered quantity is larger than its ordered quantity. */
export const deliveredOverOrdered = (tables: readonly ChangeTable[], words: QuantityWords): StructureIssue[] =>
  tables.flatMap((table) => {
    const columns = columnsOfTable(table, words);
    if (columns === undefined) return [];
    return bodyRows(table).flatMap((row) => {
      const [ordered, delivered] = countsOf(row, [columns.ordered, columns.delivered], words.qualifiers) ?? [];
      if (ordered === undefined || delivered === undefined || delivered.value <= ordered.value) return [];
      return [{ offset: offsetOf(delivered.cell), values: { delivered: plain(delivered.cell.text), ordered: plain(ordered.cell.text) } }];
    });
  });

/** The expected count written the way the backordered cell writes its own: thousands commas and the unit after it. */
const shownCount = (value: number, written: Count): string => {
  const text = plain(written.cell.text);
  return text.replace(/^[\d,]+/u, value.toLocaleString("en-US", { useGrouping: text.includes(",") }));
};

/** Another column of the row holds a count in the same unit (opening stock, previously delivered): the remainder may count it too. */
const countsElsewhere = (row: readonly TableCell[], used: readonly number[], unit: string, qualifiers: readonly string[]): boolean =>
  row.some((cell, index) => {
    const count = used.includes(index) ? undefined : countIn(cell, qualifiers);
    return count !== undefined && sameUnit(count.unit, unit);
  });

/**
 * Each row whose backordered quantity is not the ordered less the delivered. A row that delivered more than was ordered is
 * left to delivered-over-ordered: what is left of it is no count.
 */
export const backorderMismatches = (tables: readonly ChangeTable[], words: QuantityWords): StructureIssue[] =>
  tables.flatMap((table) => {
    const columns = columnsOfTable(table, words);
    if (columns?.backordered === undefined) return [];
    const backorderedColumn = columns.backordered;
    return bodyRows(table).flatMap((row) => {
      const used = [columns.ordered, columns.delivered, backorderedColumn];
      const [ordered, delivered, backordered] = countsOf(row, used, words.qualifiers) ?? [];
      if (ordered === undefined || delivered === undefined || backordered === undefined || delivered.value > ordered.value) return [];
      if (countsElsewhere(row, used, ordered.unit, words.qualifiers)) return [];
      const expected = ordered.value - delivered.value;
      if (backordered.value === expected) return [];
      return [{ offset: offsetOf(backordered.cell), values: { backordered: plain(backordered.cell.text), computed: shownCount(expected, backordered) } }];
    });
  });
