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

// 変換で一文に流れ込んだ表（自作）: 行ごとの同じ「経常的」と、前の行を繰り返す「〃」のセル。
const FLATTENED_TABLE =
  "会社名設備の内容投資予定金額(百万円)資金調達方法東西工業株式会社機器事業経常的更新1,251―自己資金部品事業経常的更新417―〃〃全社経常的更新919―〃〃\n";

describe("teki-overuse: 平らにした表", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 「〃」のセルが並ぶ表の行は、文として数えない", () => {
    assert.deepEqual(tekiCounts(FLATTENED_TABLE, "business/report"), []);
  });

  it("invalid: 同じ「〜的」を並べた文は数える", () => {
    assert.deepEqual(tekiCounts("機器は経常的に、部品も経常的に、全社でも経常的に更新します。\n", "business/report"), [3]);
  });
});
