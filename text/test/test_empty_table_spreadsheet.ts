import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tableBlanks } from "../packages/chaff/src/detectors/blank-structure.ts";
import { picturesSpreadsheet } from "../packages/chaff/src/detectors/spreadsheet-grid.ts";

// empty-table-cell and a table that pictures a spreadsheet (column letters A, B, C over row numbers 1, 2, 3): an empty
// cell there is an empty cell of the sheet. Every table is self-written.

const names = (source: string): string[] => tableBlanks(source).map((blank) => blank.name);

const ROWS = ["1", "2", "3"];

describe("picturesSpreadsheet", () => {
  it("an empty corner, column letters in order, and row numbers in order", () => {
    assert.equal(picturesSpreadsheet(["", "A", "B", "C"], ROWS), true);
    assert.equal(picturesSpreadsheet([" ", " A ", "B"], [" 1 ", "2"]), true);
  });

  it("not without the corner, letters out of order or not from A, one letter, lower case, or no rows", () => {
    assert.equal(picturesSpreadsheet(["A", "B"], ROWS), false);
    assert.equal(picturesSpreadsheet(["", "A", "C"], ROWS), false);
    assert.equal(picturesSpreadsheet(["", "B", "C"], ROWS), false);
    assert.equal(picturesSpreadsheet(["", "A"], ROWS), false);
    assert.equal(picturesSpreadsheet(["", "a", "b"], ROWS), false);
    assert.equal(picturesSpreadsheet(["Item", "A", "B"], ROWS), false);
    assert.equal(picturesSpreadsheet([], ROWS), false);
    assert.equal(picturesSpreadsheet(["", "A", "B"], []), false);
  });

  it("not when the first column is not the sheet's row numbers from 1", () => {
    assert.equal(picturesSpreadsheet(["", "A", "B"], ["r1", "r2", "r3"]), false);
    assert.equal(picturesSpreadsheet(["", "A", "B"], ["2", "3", "4"]), false);
    assert.equal(picturesSpreadsheet(["", "A", "B"], ["1", "3", "4"]), false);
  });
});

describe("empty-table-cell: a table that pictures a spreadsheet", () => {
  it("does not report an empty row of the sheet", () => {
    const sheet = ["|| A | B | C |", "|-|-|-|-|", "| 1 | Visitors | Days | Rate |", "| 2 | 513 | 3 | 171 |", "| 3 | 480 | 3 | 160 |", "| 4 | | | |"];
    assert.deepEqual(names(sheet.join("\n")), []);
  });

  it("still reports a blank in options A and B, or under row labels that are not row numbers", () => {
    assert.deepEqual(names(["| A | B |", "|---|---|", "| x | y |", "| z | y |", "| q |   |"].join("\n")), ["B"]);
    assert.deepEqual(names(["|   | A | B |", "|---|---|---|", "| r1 | x | y |", "| r2 | z | y |", "| r3 | q |   |"].join("\n")), ["B"]);
  });

  it("still reports a blank in a table whose header names its columns", () => {
    const report = ["| Row | Visitors | Days | Rate |", "|-|-|-|-|", "| 1 | 513 | 3 | 171 |", "| 2 | 480 | 3 | 160 |", "| 3 | 450 | | 150 |"];
    assert.deepEqual(names(report.join("\n")), ["Days"]);
  });
});
