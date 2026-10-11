import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import type { ChangeTable } from "../packages/chaff/src/structure/change-rate-table.ts";
import { netOverGross, weightColumnsOf, type WeightWord, type WeightWords } from "../packages/chaff/src/structure/net-gross-weight.ts";

// 梱包明細書の一行で、正味重量が総重量より重い（net-over-gross）。例の表は自作。

const COLUMNS: readonly WeightWord[] = [
  { pattern: "正味重量", role: "net" },
  { pattern: "純重量", role: "net" },
  { pattern: "net weight", role: "net" },
  { pattern: "n.w.", role: "net" },
  { pattern: "総重量", role: "gross" },
  { pattern: "gross weight", role: "gross" },
  { pattern: "g.w.", role: "gross" },
];
const UNITS = [
  { pattern: "t", factor: 1_000_000 },
  { pattern: "kg", factor: 1000 },
  { pattern: "g", factor: 1 },
];
const WORDS: WeightWords = { columns: COLUMNS, qualifiers: ["以上", "程度", "or more", "approx."], units: UNITS };

/** A table written as rows of cell texts, with offsets counted along one line per row. */
const tableOf = (rows: readonly (readonly string[])[]): ChangeTable => {
  const lines = rows.map((texts, line) =>
    texts.map((text, index) => {
      const start = line * 1000 + index * 100;
      return { start, end: start + text.length, text };
    }),
  );
  const [header = [], ...body] = lines;
  return { header, rows: body };
};

const rowOf = (offset: number): string => String(Math.floor(offset / 1000));

const issues = (rows: readonly (readonly string[])[]): string[] =>
  netOverGross([tableOf(rows)], WORDS).map((issue) => `${rowOf(issue.offset)}:${String(issue.values["net"])}>${String(issue.values["gross"])}`);

const JA_HEADER = ["箱番号", "品名", "正味重量", "総重量"];
const EN_HEADER = ["Carton", "Description", "Net weight", "Gross weight"];

describe("net and gross weight: the columns the headings name", () => {
  it("finds the net and gross columns wherever they stand", () => {
    assert.deepEqual(weightColumnsOf(JA_HEADER, COLUMNS), { net: 2, gross: 3 });
    assert.deepEqual(weightColumnsOf(["G.W.", "Carton", "N.W."], COLUMNS), { net: 2, gross: 0 });
    assert.deepEqual(weightColumnsOf(["Carton", "Net weight (kg)", "Gross Weight (kg)"], COLUMNS), { net: 1, gross: 2 });
    assert.deepEqual(weightColumnsOf(["箱", "純重量（kg）", "総重量 (kg)"], COLUMNS), { net: 1, gross: 2 });
  });
  it("no net or gross column, or two of a role, is no table to read", () => {
    assert.equal(weightColumnsOf(["品名", "数量", "重量"], COLUMNS), undefined);
    assert.equal(weightColumnsOf(["Carton", "Net weight"], COLUMNS), undefined);
    assert.equal(weightColumnsOf(["Carton", "Gross weight"], COLUMNS), undefined);
    assert.equal(weightColumnsOf(["Carton", "Net weight", "N.W.", "Gross weight"], COLUMNS), undefined);
    assert.equal(weightColumnsOf(["Carton", "Net weight", "Gross weight", "G.W."], COLUMNS), undefined);
    assert.equal(weightColumnsOf([], COLUMNS), undefined);
  });
  it("a heading that names both, or headings that differ besides net and gross, are not read", () => {
    assert.equal(weightColumnsOf(["Carton", "Net weight / Gross weight", "Gross weight"], COLUMNS), undefined);
    assert.equal(weightColumnsOf(["Carton", "Net weight", "Gross weight (net weight and packing)"], COLUMNS), undefined);
    assert.equal(weightColumnsOf(["Carton", "Net weight per piece", "Gross weight per carton"], COLUMNS), undefined);
    assert.equal(weightColumnsOf(["Carton", "Net weight (kg)", "Gross weight (lb)"], COLUMNS), undefined);
    assert.equal(weightColumnsOf(["品名", "1個あたり正味重量", "総重量"], COLUMNS), undefined);
  });
});

describe("net-over-gross", () => {
  it("reports a row whose net weight is larger than its gross weight, at the net cell", () => {
    const table = [JA_HEADER, ["No.1", "ベアリング", "78.0kg", "84.5kg"], ["No.2", "ハウジング", "106.0kg", "104.0kg"]];
    assert.deepEqual(issues(table), ["2:106.0kg>104.0kg"]);
    const en = [EN_HEADER, ["No. 1", "Sensor", "36.0 kg", "41.5 kg"], ["No. 2", "Control unit", "68.0 kg", "65.0 kg"]];
    assert.deepEqual(issues(en), ["2:68.0 kg>65.0 kg"]);
  });
  it("the totals row is compared too", () => {
    const table = [JA_HEADER, ["No.1", "ベアリング", "78.0kg", "84.5kg"], ["合計", "1箱", "90.0kg", "84.5kg"]];
    assert.deepEqual(issues(table), ["2:90.0kg>84.5kg"]);
  });
  it("equal or lighter net weight is not reported", () => {
    assert.deepEqual(issues([EN_HEADER, ["No. 1", "Sensor", "41.5 kg", "41.5 kg"], ["No. 2", "Unit", "40 kg", "41.5 kg"]]), []);
  });
  it("weights in g, kg and t are converted before they are compared", () => {
    assert.deepEqual(issues([EN_HEADER, ["No. 1", "Screws", "900 g", "0.8 kg"]]), ["1:900 g>0.8 kg"]);
    assert.deepEqual(issues([EN_HEADER, ["No. 1", "Screws", "800 g", "0.9 kg"], ["No. 2", "Steel", "1.2 t", "1,250 kg"]]), []);
    assert.deepEqual(issues([EN_HEADER, ["No. 1", "Screws", "100 g", "0.1 kg"], ["No. 2", "Nuts", "2010 g", "2.01 kg"]]), []);
  });
  it("cells without a unit are compared when neither has one; a unit not in the list only with itself", () => {
    assert.deepEqual(
      issues([
        ["Carton", "Net weight (kg)", "Gross weight (kg)"],
        ["No. 1", "68.0", "65.0"],
      ]),
      ["1:68.0>65.0"],
    );
    assert.deepEqual(issues([EN_HEADER, ["No. 1", "Unit", "68.0", "65.0 kg"]]), []);
    assert.deepEqual(issues([EN_HEADER, ["No. 1", "Unit", "150 lb", "65 kg"]]), []);
    assert.deepEqual(issues([EN_HEADER, ["No. 1", "Unit", "150 lb", "140 lbs"]]), ["1:150 lb>140 lbs"]);
  });
  it("a blank, dash, TBD, approximate or bound cell is not compared", () => {
    const rows = [
      ["No. 1", "Unit", "", "65.0 kg"],
      ["No. 2", "Unit", "-", "65.0 kg"],
      ["No. 3", "Unit", "68.0 kg", "TBD"],
      ["No. 4", "Unit", "approx. 68 kg", "65 kg"],
      ["No. 5", "Unit", "68 kg or more", "65 kg"],
      ["No. 6", "Unit", "(68 kg)", "65 kg"],
      ["No. 7", "Unit", "68 kg or more", "65 kg or more"],
    ];
    assert.deepEqual(issues([EN_HEADER, ...rows]), []);
    assert.deepEqual(
      issues([JA_HEADER, ["No.1", "部品", "約106kg", "104kg"], ["No.2", "部品", "106kg以上", "104kg以上"], ["No.3", "部品", "106kg", "－"]]),
      [],
    );
  });
  it("a row shorter or longer than the header is not read", () => {
    assert.deepEqual(issues([EN_HEADER, ["No. 1", "68.0 kg", "65.0 kg"], ["No. 2", "Unit", "68.0 kg", "65.0 kg", "x"]]), []);
  });
  it("a table without both columns has nothing to compare", () => {
    assert.deepEqual(
      issues([
        ["Carton", "Net weight", "Volume"],
        ["No. 1", "68.0 kg", "0.2 m3"],
      ]),
      [],
    );
    assert.deepEqual(netOverGross([], WORDS), []);
  });
});

const run = (adapter: LanguageAdapter, text: string): string[] =>
  runRules(buildDocument("t.md", text, adapter), loadRules(adapter.id), { "net-over-gross": "normal" }, false, "business/proposal")
    .findings.filter((finding) => finding.rule === "net-over-gross")
    .map((finding) => String(finding.line));

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

const JA_TABLE = [
  "| 箱番号 | 品名 | 数量 | 正味重量 | 総重量 |",
  "| --- | --- | --- | --- | --- |",
  "| No.1 | ベアリング | 60個 | 78.0kg | 84.5kg |",
  "| No.2 | ハウジング | 30個 | 106.0kg | 104.0kg |",
  "| 合計 | 2箱 | | 184.0kg | 188.5kg |",
];
const EN_TABLE = [
  "| Carton | Description | Quantity | N.W. | G.W. |",
  "| --- | --- | --- | --- | --- |",
  "| No. 1 | Flow sensor | 40 pcs | 36.0 kg | 41.5 kg |",
  "| No. 2 | Control unit | 10 pcs | 68.0 kg | 65.0 kg |",
  "| Total | 2 cartons | | 104.0 kg | 106.5 kg |",
];
const documentOf = (title: string, table: readonly string[]): string => [title, "", ...table, ""].join("\n");

describe("net-over-gross: through the rule", () => {
  it("ja: 梱包明細書", () => {
    assert.deepEqual(run(ja, documentOf("# 梱包明細書", JA_TABLE)), ["6"]);
    const fixed = JA_TABLE.map((line) => line.replace("106.0kg", "96.0kg").replace("184.0kg", "174.0kg"));
    assert.deepEqual(run(ja, documentOf("# 梱包明細書", fixed)), []);
  });
  it("en: a packing list", () => {
    assert.deepEqual(run(en, documentOf("# Packing List", EN_TABLE)), ["6"]);
    const fixed = EN_TABLE.map((line) => line.replace("68.0 kg", "58.0 kg").replace("104.0 kg", "94.0 kg"));
    assert.deepEqual(run(en, documentOf("# Packing List", fixed)), []);
  });
  it("a table that lists one weight per row is not read", () => {
    const table = ["| 品名 | 数量 | 重量 |", "| --- | --- | --- |", "| 部品 | 30個 | 106.0kg |"];
    assert.deepEqual(run(ja, documentOf("# 梱包明細書", table)), []);
  });
});
