import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { columnOf, countIn, firstIn, lastIn, lowerBound } from "../packages/chaff/src/detectors/token-column.ts";

// A column answers "how many pass", "the first" and "the last" for a range without reading it. Each answer is checked
// against reading the range, over generated rows: some tokens pass, some are set aside with a key, and a question leaves
// out the tokens set aside with one key (or all of them).

const SEED = Number(process.env["CHAFF_COLUMN_SEED"] ?? "170");
console.log(`test_token_column seed: ${String(SEED)}`);

const randomFrom = (seed: number): (() => number) => {
  const state = { value: seed >>> 0 };
  return () => {
    state.value = (Math.imul(state.value, 1_103_515_245) + 12_345) >>> 0;
    return state.value / 4_294_967_296;
  };
};

type Cell = { readonly passes: boolean; readonly key: number | undefined };

const KEYS = 3;

const rowOf = (random: () => number, length: number): Cell[] =>
  Array.from({ length }, () => ({ passes: random() < 0.5, key: random() < 0.4 ? Math.floor(random() * KEYS) : undefined }));

const counts = (cell: Cell, excluded: number | undefined): boolean =>
  cell.passes && (cell.key === undefined || (excluded !== undefined && cell.key !== excluded));

const indicesIn = (row: readonly Cell[], start: number, end: number, excluded: number | undefined): number[] =>
  row.flatMap((cell, index) => (index >= start && index < end && counts(cell, excluded) ? [index] : []));

/** Asks random questions of one row; returns how many. */
const checkRow = (random: () => number, row: readonly Cell[]): number => {
  const column = columnOf(
    row,
    (cell) => cell.passes,
    (cell) => cell.key,
  );
  const questions = Array.from({ length: 30 }, () => {
    const start = Math.floor(random() * (row.length + 1));
    const end = start + Math.floor(random() * (row.length + 1 - start));
    const excluded = random() < 0.2 ? undefined : Math.floor(random() * KEYS);
    return { start, end, excluded };
  });
  questions.forEach(({ start, end, excluded }) => {
    const indices = indicesIn(row, start, end, excluded);
    assert.equal(countIn(column, { start, end }, excluded), indices.length);
    assert.equal(firstIn(column, { start, end }, excluded), indices[0] ?? -1);
    assert.equal(lastIn(column, { start, end }, excluded), indices.at(-1) ?? -1);
  });
  return questions.length;
};

describe(`token columns: answers match reading the range (seed ${String(SEED)})`, () => {
  it("counts, finds the first and finds the last passing token, with each key left out", () => {
    const random = randomFrom(SEED);
    const checked = Array.from({ length: 400 }, () => rowOf(random, Math.floor(random() * 40))).reduce((total, row) => total + checkRow(random, row), 0);
    assert.ok(checked > 0);
  });

  it("finds where a value would go in a sorted list", () => {
    assert.equal(lowerBound([], 3), 0);
    assert.equal(lowerBound([1, 3, 3, 5], 3), 1);
    assert.equal(lowerBound([1, 3, 3, 5], 4), 3);
    assert.equal(lowerBound([1, 3, 3, 5], 9), 4);
    assert.equal(lowerBound([1, 3, 3, 5], 0), 0);
  });
});
