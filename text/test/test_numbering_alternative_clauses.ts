import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { alternativeReader, placeholderStarts } from "../packages/chaff/src/structure/alternative-clause.ts";
import type { LanguageAdapter, StructureNode } from "../packages/chaff/src/plugin.ts";

// numbering-gap: a model contract offers a clause to choose instead of another under the same number
// (第4条（変更オプション条項）after 第4条), and a clause to add with its number left blank (第●条). Neither is a slip in
// the numbering. Self-written text in the shape of the 特許庁 OI model contracts.

const gapsOf = (adapter: LanguageAdapter, source: string): [unknown, unknown][] =>
  runRules(buildDocument("c.md", source, adapter), loadRules(adapter.id), {}, true, "legal/contract")
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => [finding.values["previous"], finding.values["label"]]);

const contract = (...lines: string[]): string => ["# 秘密保持契約書", "", "第1条（目的）", "甲は、乙に情報を開示する。", "", ...lines, ""].join("\n");

const ARTICLE_2 = ["第2条（複製）", "乙は、情報を複製しない。", ""];
const ARTICLE_3 = ["第3条（返還）", "乙は、情報を返還する。", ""];

describe("numbering-gap: alternative and blank-numbered clauses", () => {
  it("does not report a clause that repeats the number before it and is named an alternative, in its heading or the line before", () => {
    assert.deepEqual(
      gapsOf(ja, contract(...ARTICLE_2, "第2条（変更オプション条項：厳格な複製条件）", "乙は、承諾なく情報を複製しない。", "", ...ARTICLE_3)),
      [],
    );
    assert.deepEqual(
      gapsOf(ja, contract(...ARTICLE_2, "【2条変更オプション条項：複製】", "", "第2条　乙は、承諾なく情報を複製しない。", "", ...ARTICLE_3)),
      [],
    );
  });

  it("still reports a repeated number that is not named an alternative, and an alternative that does not repeat the number before it", () => {
    assert.deepEqual(gapsOf(ja, contract(...ARTICLE_2, "第2条（厳格な複製条件）", "乙は、承諾なく情報を複製しない。", "", ...ARTICLE_3)), [["第2条", "第2条"]]);
    assert.deepEqual(gapsOf(ja, contract(...ARTICLE_2, "第4条（変更オプション条項：返還）", "乙は、情報を返還する。", "")), [["第2条", "第4条"]]);
  });

  it("numbers the paragraphs of a blank-numbered clause afresh", () => {
    const blank = contract(
      ...ARTICLE_2,
      "2　乙は、複製物を管理する。",
      "",
      "3　乙は、複製物を返す。",
      "",
      "第●条（追加オプション条項：変更）",
      "甲および乙は、協議する。",
      "",
      "2　変更は書面で行う。",
      "",
    );
    assert.deepEqual(gapsOf(ja, blank), []);
  });

  it("still reports paragraphs that go backwards with no blank-numbered clause between", () => {
    const backwards = contract(...ARTICLE_2, "2　乙は、複製物を管理する。", "", "3　乙は、複製物を返す。", "", "2　変更は書面で行う。", "");
    assert.deepEqual(gapsOf(ja, backwards), [["3", "2"]]);
  });

  it("reads English: a section that repeats its number marked Alternative", () => {
    const source = [
      "# Services Agreement",
      "",
      "## 1. Term",
      "",
      "Text.",
      "",
      "## 2. Fees",
      "",
      "Text.",
      "",
      "## 2. Fees [Alternative]",
      "",
      "Text.",
      "",
      "## 3. Notices",
      "",
      "Text.",
      "",
    ].join("\n");
    assert.deepEqual(gapsOf(en, source), []);
    assert.deepEqual(gapsOf(en, source.replace(" [Alternative]", "")), [["2", "2"]]);
  });
});

const node = (heading: string | undefined, start: number): StructureNode => ({
  kind: "article",
  address: "2",
  line: 1,
  attrs: heading === undefined ? {} : { heading },
  children: [],
  span: { start, end: start },
});

describe("alternativeReader and placeholderStarts", () => {
  const SOURCE = "第2条　本文\n\n【2条変更オプション条項】\n\n第2条　別案\n";
  const isAlternative = alternativeReader(SOURCE, ["オプション条項"]);

  it("reads the heading, then the last line with text before the division", () => {
    assert.equal(isAlternative(node("変更オプション条項：厳格", 0)), true);
    assert.equal(isAlternative(node(undefined, SOURCE.indexOf("第2条　別案"))), true);
    assert.equal(isAlternative(node(undefined, 0)), false);
    assert.equal(isAlternative(node("目的", 0)), false);
    assert.equal(alternativeReader(SOURCE, [""])(node(undefined, SOURCE.indexOf("第2条　別案"))), false);
  });

  it("finds the lines that start with a blank-numbered division", () => {
    const source = "第1条　本文\n第●条　追加\n　第○条　追加\n本文の第●条\n";
    assert.deepEqual(placeholderStarts(source, ["第●条", "第○条"]), [source.indexOf("第●条"), source.indexOf("　第○条")]);
    assert.deepEqual(placeholderStarts(source, [""]), []);
    assert.deepEqual(placeholderStarts("", ["第●条"]), []);
  });
});
