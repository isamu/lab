import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { linesOf } from "../packages/chaff/src/structure/lines.ts";
import { tablesOf } from "../packages/chaff/src/facts/table-facts.ts";
import {
  amountOf,
  moveOf,
  namesItem,
  revisionDirectionMismatches,
  revisionItems,
  type RevisionWords,
} from "../packages/chaff/src/structure/revision-direction.ts";

// A forecast revision said to go one way while its table goes the other (revision-direction-mismatch).

const RULE = "revision-direction-mismatch";

const found = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map(
      (finding) =>
        `${String(finding.values["word"])} ${String(finding.values["item"])} ${String(finding.values["previous"])}>${String(finding.values["revised"])}`,
    );

const jaTable = (...rows: string[]): string => ["| 項目 | 前回予想 | 今回予想 |", "| --- | --- | --- |", ...rows].join("\n");
const enTable = (...rows: string[]): string => ["| Item | Previous forecast | Revised forecast |", "| --- | --- | --- |", ...rows].join("\n");

const jaDoc = (...blocks: string[]): string[] =>
  found(["# 決算短信", "", "## 通期業績予想の修正", "", ...blocks.flatMap((block) => [block, ""])].join("\n"), ja);
const enDoc = (...blocks: string[]): string[] =>
  found(["# Results", "", "## Revised full-year forecast", "", ...blocks.flatMap((block) => [block, ""])].join("\n"), en);

const words: RevisionWords = {
  rises: ["上方修正", "revised upward"],
  falls: ["下方修正"],
  risesWithObject: [],
  fallsWithObject: ["lowered"],
  objects: ["forecast"],
  previous: ["前回予想", "previous forecast"],
  revised: ["今回予想", "revised forecast"],
};

const tableOf = (source: string) => {
  const [table] = tablesOf(linesOf(source));
  assert.ok(table !== undefined);
  return table;
};

describe("revision-direction pieces", () => {
  it("amountOf reads a number with its unit and sign, and nothing else", () => {
    assert.deepEqual(amountOf(" 5,200 "), { value: 5200, unit: "|" });
    assert.deepEqual(amountOf("△120"), { value: -120, unit: "|" });
    assert.deepEqual(amountOf("**$5,400 million**"), { value: 5400, unit: "$|million" });
    assert.deepEqual(amountOf("5,400百万円"), { value: 5400, unit: "|百万円" });
    assert.deepEqual(amountOf("１２.５"), { value: 12.5, unit: "|" });
    ["―", "-", "未定", "", "TBD", "5,200〜5,400", "5,200 / 5,400", "(120)"].forEach((cell) => assert.equal(amountOf(cell), undefined, cell));
  });

  it("namesItem finds a label as written or without its brackets, and not a part of another word", () => {
    assert.equal(namesItem("営業利益を上方修正", "営業利益（百万円）"), true);
    assert.equal(namesItem("raised the operating profit forecast", "Operating profit (loss)"), true);
    assert.equal(namesItem("raised the net sales forecast", "Net sales"), true);
    assert.equal(namesItem("raised the forecast", "Net sales"), false);
    assert.equal(namesItem("raised the net salesforce forecast", "Net sales"), false);
    assert.equal(namesItem("raised the forecast", "(A)"), false);
  });

  it("moveOf says which way the item moved, and nothing when it cannot", () => {
    const item = (previous: string, revised: string) => ({
      label: "売上高",
      previous: { start: 0, end: 0, text: previous },
      revised: { start: 0, end: 0, text: revised },
    });
    assert.equal(moveOf(item("5,200", "5,400")), 1);
    assert.equal(moveOf(item("5,200", "5,000")), -1);
    assert.equal(moveOf(item("△120", "△80")), 1);
    assert.equal(moveOf(item("5,200", "5,200")), undefined);
    assert.equal(moveOf(item("5,200", "―")), undefined);
    assert.equal(moveOf(item("5,200百万円", "5.4十億円")), undefined);
  });

  it("revisionItems reads the forecasts in columns or in rows, and no other table", () => {
    const byRow = revisionItems(tableOf(jaTable("| 売上高 | 5,200 | 5,000 |", "| 営業利益 | 380 | 410 |")), words);
    assert.deepEqual(
      byRow?.map((item) => `${item.label} ${item.previous.text.trim()} ${item.revised.text.trim()}`),
      ["売上高 5,200 5,000", "営業利益 380 410"],
    );
    const byColumn = revisionItems(
      tableOf(
        ["| | 売上高 | 営業利益 |", "| --- | --- | --- |", "| 前回予想（A） | 5,200 | 380 |", "| 今回予想（B） | 5,000 | 410 |", "| 増減額 | △200 | 30 |"].join(
          "\n",
        ),
      ),
      words,
    );
    assert.deepEqual(
      byColumn?.map((item) => `${item.label} ${item.previous.text.trim()} ${item.revised.text.trim()}`),
      ["売上高 5,200 5,000", "営業利益 380 410"],
    );
    assert.equal(revisionItems(tableOf(["| 項目 | 前年同期 | 当期 |", "| --- | --- | --- |", "| 売上高 | 2,400 | 2,640 |"].join("\n")), words), undefined);
    assert.equal(revisionItems(tableOf(["| 項目 | 前回予想 | 前回予想 |", "| --- | --- | --- |", "| 売上高 | 1 | 2 |"].join("\n")), words), undefined);
  });

  it("revisionDirectionMismatches reads the section only, and points at the revised cell", () => {
    const text = ["## A", "", "上方修正します。", "", "## B", "", jaTable("| 売上高 | 5,200 | 5,000 |")].join("\n");
    const sectionStarts = [0, text.indexOf("## B")];
    assert.deepEqual(revisionDirectionMismatches({ text, sectionStarts, units: [] }, words), []);
    const joined = { text, sectionStarts: [0], units: [] };
    const [issue] = revisionDirectionMismatches(joined, words);
    assert.equal(issue?.offset, text.indexOf("5,000"));
    assert.equal(issue?.values["word"], "上方修正");
  });
});

describe("revision-direction-mismatch (ja)", () => {
  it("reports a revision said upward whose first item went down", () => {
    assert.deepEqual(jaDoc("通期の業績予想を次のとおり上方修正します。", jaTable("| 売上高 | 5,200 | 5,000 |", "| 営業利益 | 380 | 410 |")), [
      "上方修正 売上高 5,200>5,000",
    ]);
  });

  it("reports a revision said downward whose items went up, in rows of 前回 and 今回", () => {
    const rows = ["| | 売上高 | 営業利益 |", "| --- | --- | --- |", "| 前回発表予想（A） | 5,200 | 380 |", "| 今回修正予想（B） | 5,400 | 410 |"].join("\n");
    assert.deepEqual(jaDoc("業績予想を減額修正いたします。", rows), ["減額修正 売上高 5,200>5,400"]);
  });

  it("checks the items the sentence names", () => {
    assert.deepEqual(jaDoc("営業利益を上方修正します。", jaTable("| 売上高 | 5,200 | 5,400 |", "| 営業利益 | 380 | 350 |")), ["上方修正 営業利益 380>350"]);
    assert.deepEqual(jaDoc("営業利益を上方修正します。", jaTable("| 売上高 | 5,200 | 5,000 |", "| 営業利益 | 380 | 410 |")), []);
  });

  it("reads 引き上げ only beside a word of forecast", () => {
    assert.deepEqual(jaDoc("価格を引き上げました。", jaTable("| 売上高 | 5,200 | 5,000 |")), []);
    assert.deepEqual(jaDoc("通期の予想を引き上げます。", jaTable("| 売上高 | 5,200 | 5,000 |")), ["引き上げ 売上高 5,200>5,000"]);
  });

  it("reads a word in the heading", () => {
    const doc = found(["# 決算短信", "", "## 業績予想の上方修正", "", jaTable("| 売上高 | 5,200 | 5,000 |")].join("\n"), ja);
    assert.deepEqual(doc, ["上方修正 売上高 5,200>5,000"]);
  });

  it("is silent when the table agrees", () => {
    assert.deepEqual(jaDoc("業績予想を上方修正します。", jaTable("| 売上高 | 5,200 | 5,400 |", "| 営業利益 | 380 | 350 |")), []);
    assert.deepEqual(jaDoc("業績予想を下方修正します。", jaTable("| 売上高 | 5,200 | 5,000 |")), []);
  });

  it("is silent when the named items move both ways", () => {
    assert.deepEqual(jaDoc("売上高と営業利益を上方修正します。", jaTable("| 売上高 | 5,200 | 5,000 |", "| 営業利益 | 380 | 410 |")), []);
  });

  it("is silent with words of both directions, with no word, or with cells that are not numbers", () => {
    assert.deepEqual(jaDoc("売上高を下方修正し、営業利益を上方修正します。", jaTable("| 売上高 | 5,200 | 5,400 |", "| 営業利益 | 380 | 350 |")), []);
    assert.deepEqual(jaDoc("業績予想を修正します。", jaTable("| 売上高 | 5,200 | 5,000 |")), []);
    assert.deepEqual(jaDoc("業績予想を上方修正します。", jaTable("| 売上高 | ― | 5,000 |")), []);
    assert.deepEqual(jaDoc("業績予想を上方修正します。", jaTable("| 売上高 | 5,200 | 5,200 |")), []);
  });

  it("is silent on a table without previous and revised columns", () => {
    const table = ["| 項目 | 前年同期 | 当期 |", "| --- | --- | --- |", "| 売上高 | 2,400 | 2,200 |"].join("\n");
    assert.deepEqual(jaDoc("業績予想を上方修正します。", table), []);
  });

  it("reads only the word's own section", () => {
    const doc = ["# 決算短信", "", "## 1 業績", "", "前期は上方修正しました。", "", "## 2 予想", "", jaTable("| 売上高 | 5,200 | 5,000 |")].join("\n");
    assert.deepEqual(found(doc, ja), []);
  });
});

describe("revision-direction-mismatch (en)", () => {
  it("reports a revision said upward whose first item went down", () => {
    assert.deepEqual(
      enDoc("We are revising upward the full-year forecast, as follows.", enTable("| Net sales | 5,200 | 5,000 |", "| Operating profit | 380 | 410 |")),
      ["revising upward Net sales 5,200>5,000"],
    );
  });

  it("reports a forecast said lowered whose figure went up, with units in the cells", () => {
    assert.deepEqual(enDoc("We lowered our forecast.", enTable("| Net sales | $5,200 million | $5,400 million |")), [
      "lowered Net sales $5,200 million>$5,400 million",
    ]);
  });

  it("reads a verb only beside a word of forecast", () => {
    assert.deepEqual(enDoc("We raised funds in April.", enTable("| Net sales | 5,200 | 5,000 |")), []);
    assert.deepEqual(enDoc("We raised the forecast.", enTable("| Net sales | 5,200 | 5,000 |")), ["raised Net sales 5,200>5,000"]);
  });

  it("names an item without what its label adds in brackets", () => {
    assert.deepEqual(enDoc("We raised our operating profit forecast.", enTable("| Net sales | 5,200 | 5,400 |", "| Operating profit (loss) | 380 | 350 |")), [
      "raised Operating profit (loss) 380>350",
    ]);
  });

  it("checks the items the sentence names", () => {
    assert.deepEqual(enDoc("We raised our operating profit forecast.", enTable("| Net sales | 5,200 | 5,400 |", "| Operating profit | 380 | 350 |")), [
      "raised Operating profit 380>350",
    ]);
  });

  it("is silent when the table agrees, the words disagree, or the cells are not numbers", () => {
    assert.deepEqual(enDoc("We revised upward the forecast.", enTable("| Net sales | 5,200 | 5,400 |")), []);
    assert.deepEqual(enDoc("We lowered the net sales forecast and raised the operating profit forecast.", enTable("| Net sales | 5,200 | 5,400 |")), []);
    assert.deepEqual(enDoc("We revised upward the forecast.", enTable("| Net sales | TBD | 5,000 |")), []);
    assert.deepEqual(enDoc("We revised the forecast.", enTable("| Net sales | 5,200 | 5,000 |")), []);
  });
});
