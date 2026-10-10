import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { keyValueCell, tableAround } from "../packages/chaff/src/structure/key-value-row.ts";
import { statedPeriod, type PeriodWords } from "../packages/chaff/src/structure/stated-period.ts";

// 二列の表の一行（| 対象期間 | 2026年4月1日〜9月30日 |）を期間として読むか。例文はすべて自作。

const LABELS = ["対象期間", "開講期間", "Reporting period", "Term"];

const valueOf = (row: string, table: readonly string[] = [row]): string | undefined => {
  const cell = keyValueCell(row, () => table, LABELS);
  return cell === undefined ? undefined : row.slice(cell.from, cell.to).trim();
};

const HEAD = ["| 項目 | 内容 |", "| --- | --- |"];

describe("keyValueCell: a two-column row labelled with a period word", () => {
  it("reads the value cell of a row whose label cell is exactly a period word, with bold or a colon", () => {
    const row = "| 対象期間 | 2026年4月1日〜2026年9月30日 |";
    assert.equal(valueOf(row, [...HEAD, row, "| 決算説明会 | 2026年11月12日 |"]), "2026年4月1日〜2026年9月30日");
    assert.equal(valueOf("| **Reporting period** | April 1 – September 30, 2026 |"), "April 1 – September 30, 2026");
    assert.equal(valueOf("| 開講期間： | 2026年4月10日〜7月31日 |"), "2026年4月10日〜7月31日");
    assert.equal(valueOf("|term|April 8 – July 28, 2026|"), "April 8 – July 28, 2026");
    assert.equal(valueOf("  | Term | April 8 – July 28, 2026"), "April 8 – July 28, 2026");
  });

  it("does not read a row whose label cell only contains a period word", () => {
    assert.equal(valueOf("| 対象期間外 | 2026年10月1日〜 |"), undefined);
    assert.equal(valueOf("| Term 1 | April 8 – July 28, 2026 |"), undefined);
    assert.equal(valueOf("| Spring term | April 8 – July 28, 2026 |"), undefined);
    assert.equal(valueOf("| 第1期 | 2026年4月1日〜9月30日 |"), undefined);
  });

  it("does not read a row of more than two cells, or a row that is not a table row", () => {
    assert.equal(valueOf("| 対象期間 | 2026年4月1日〜9月30日 | 第2四半期 |"), undefined);
    assert.equal(valueOf("| 対象期間 |"), undefined);
    assert.equal(valueOf("対象期間 | 2026年4月1日〜9月30日"), undefined);
    assert.equal(valueOf("対象期間：2026年4月1日〜9月30日"), undefined);
    assert.equal(valueOf(""), undefined);
  });

  it("does not read a table where more than one row is labelled with a period word", () => {
    const first = "| 対象期間 | 2025年4月1日〜2025年9月30日 |";
    const second = "| 対象期間 | 2026年4月1日〜2026年9月30日 |";
    assert.equal(valueOf(first, [...HEAD, first, second]), undefined);
    assert.equal(valueOf(second, [...HEAD, first, second]), undefined);
    const term = "| Term | April 8 – July 28, 2026 |";
    assert.equal(valueOf(term, [term, "| Reporting period | April 1 – September 30, 2026 |"]), undefined);
  });

  it("asks for the table only for a row labelled with a period word, so a long table is not scanned once per row", () => {
    const unread = (): string[] => {
      throw new Error("table read for a row without a period word");
    };
    assert.equal(keyValueCell("| 単位数 | 2 |", unread, LABELS), undefined);
    assert.equal(keyValueCell("| --- | --- |", unread, LABELS), undefined);
  });

  it("does not read a row missing from the table it is given", () => {
    assert.equal(valueOf("| 対象期間 | 2026年4月1日〜9月30日 |", []), undefined);
  });
});

describe("tableAround: the run of table rows around a line", () => {
  const rows = ["# 決算短信", "", "| 項目 | 内容 |", "| --- | --- |", "| 対象期間 | 2026年4月1日〜9月30日 |", "", "| 別表 | 値 |"];

  it("is every consecutive | row around the line", () => {
    assert.deepEqual(tableAround(rows, 4), rows.slice(2, 5));
    assert.deepEqual(tableAround(rows, 2), rows.slice(2, 5));
    assert.deepEqual(tableAround(rows, 6), ["| 別表 | 値 |"]);
  });

  it("is empty for a line that is not a table row, or outside the lines", () => {
    assert.deepEqual(tableAround(rows, 0), []);
    assert.deepEqual(tableAround(rows, 5), []);
    assert.deepEqual(tableAround(rows, 99), []);
    assert.deepEqual(tableAround([], 0), []);
  });
});

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WORDS: PeriodWords = { labels: ["対象期間", "Reporting period"], connectors: ["〜", "–"], months: MONTHS, weekdays: [] };

describe("statedPeriod: a key-value table row", () => {
  const row = "| 対象期間 | 2026年4月1日〜2026年9月30日 |";
  const dates = [
    { offset: 100 + 9, end: 100 + 18, value: "2026-04-01" },
    { offset: 100 + 19, end: 100 + 29, value: "2026-09-30" },
  ];

  it("reads the value cell when the row's table is given", () => {
    assert.deepEqual(
      statedPeriod(row, 100, dates, WORDS, () => [...HEAD, row]),
      { start: "2026-04-01", end: "2026-09-30", written: "2026年4月1日〜2026年9月30日" },
    );
    const english = "| Reporting period | April 1 – September 30, 2026 |";
    assert.deepEqual(
      statedPeriod(english, 0, [], WORDS, () => [english]),
      { start: "2026-04-01", end: "2026-09-30", written: "April 1 – September 30, 2026" },
    );
  });

  it("does not read a table row without its table, or in a table that lists periods", () => {
    assert.equal(statedPeriod(row, 100, dates, WORDS), undefined);
    assert.equal(
      statedPeriod(row, 100, dates, WORDS, () => [...HEAD, row, row]),
      undefined,
    );
    assert.equal(
      statedPeriod("| 対象期間 | 未定 |", 0, [], WORDS, () => ["| 対象期間 | 未定 |"]),
      undefined,
    );
  });
});
