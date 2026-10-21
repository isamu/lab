import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendixStart } from "../packages/chaff/src/detectors/figure-order.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// figure-reference-order on a paper whose appendix tables are numbered on from the text's and referred to from the
// text first. Every example is self-written.

const slipsOf = (adapter: LanguageAdapter, source: string): string[][] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, "academic/paper")
    .findings.filter((finding) => finding.rule === "figure-reference-order")
    .map((finding) => [finding.variant ?? "", String(finding.values["label"]), String(finding.values["after"])]);

const paper = [
  "# Naps",
  "",
  "## 1 Results",
  "",
  "Table 1 shows recall. Table 3 repeats it for every site, and Table 2 splits it by age.",
  "",
  "Table 1: Recall",
  "",
  "Table 2: Recall by age",
  "",
  "## Appendix A Sites",
  "",
  "Table 3 lists the sites.",
  "",
  "Table 3: Recall at every site",
  "",
].join("\n");

describe("figure-reference-order: tables in an appendix", () => {
  it("does not order an appendix table against the text's own", () => {
    assert.deepEqual(slipsOf(en, paper), []);
  });

  it("still orders the text's own tables", () => {
    const swapped = paper.replace(
      "Table 1 shows recall. Table 3 repeats it for every site, and Table 2",
      "Table 2 splits it first. Table 1 shows recall, and Table 2",
    );
    assert.deepEqual(slipsOf(en, swapped), [["order", "Table 1", "Table 2"]]);
  });

  it("orders them all when the heading names no appendix", () => {
    assert.deepEqual(slipsOf(en, paper.replace("## Appendix A Sites", "## 2 Sites")), [["order", "Table 2", "Table 3"]]);
  });

  it("finds the appendix by a label of a kind not placed in the text, in capitals too", () => {
    const headings = [
      { text: "1 Results", start: 0 },
      { text: "APPENDIX A Sites", start: 50 },
      { text: "Appendix B Ages", start: 90 },
    ];
    assert.equal(appendixStart(headings, ["Appendix", "Annex"]), 50);
    assert.equal(appendixStart(headings.slice(0, 1), ["Appendix", "Annex"]), undefined);
    assert.equal(appendixStart([{ text: "Tables", start: 0 }], []), undefined);
  });

  it("reads a Japanese appendix heading the same way", () => {
    const source = "# 昼寝\n\n## 1 結果\n\n表1に結果を示す。表3に全地点を、表2に年齢別を示す。\n\n表1　結果\n\n表2　年齢別\n\n## 付録A 地点\n\n表3　全地点\n";
    assert.deepEqual(slipsOf(ja, source), []);
    assert.deepEqual(slipsOf(ja, source.replace("## 付録A 地点", "## 2 地点")), [["order", "表2", "表3"]]);
  });
});
