import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// teki-overuse: 随筆の「〜的」の重なりは作者の文体で、数えない。例文は寺田寅彦「災難雑考」（青空文庫、著作権切れ）から短く採った。

const RULES = loadRules("ja");

const tekiCounts = (source: string, genre: string): number[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre)
    .findings.filter((finding) => finding.rule === "teki-overuse")
    .map((finding) => Number(finding.values?.["count"]));

const ESSAY = "シナの主要な国土の大部分は、気象的にも地球物理的にも比較的にきわめて平穏な条件のもとにおかれているようである。\n";

describe("teki-overuse: 随筆", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 随筆（literature/essay）では数えない", () => {
    assert.deepEqual(tekiCounts(ESSAY, "literature/essay"), []);
  });

  it("invalid: 同じ文を報告書に書けば数える", () => {
    assert.deepEqual(tekiCounts(ESSAY, "business/report"), [3]);
  });
});
