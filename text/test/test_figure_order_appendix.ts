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

  it("finds the appendix by a label of a kind not placed in the text, in any case, singular or plural, as a whole word", () => {
    const words = ["Appendix", "Appendices", "Annex", "付録"];
    const at = (text: string): number | undefined =>
      appendixStart(
        [
          { text: "1 Results", start: 0 },
          { text, start: 50 },
        ],
        words,
      );
    assert.equal(at("APPENDIX A Sites"), 50);
    assert.equal(at("appendix A sites"), 50);
    assert.equal(at("Appendices"), 50);
    assert.equal(at("付録A 地点"), 50);
    assert.equal(at("Annexation study"), undefined);
    assert.equal(at("2 Sites"), undefined);
    assert.equal(appendixStart([{ text: "Tables", start: 0 }], []), undefined);
  });

  it("orders the appendix tables among themselves by the references inside the appendix", () => {
    const inAppendix = paper.replace("Table 3 lists the sites.", "Table 4 lists the regions and Table 3 the sites.\n\nTable 4: Regions");
    assert.deepEqual(slipsOf(en, inAppendix), [["order", "Table 3", "Table 4"]]);
  });

  it("keeps a number captioned in the text the text's, when the appendix restarts its numbering", () => {
    const restarted = paper
      .replace("Table 3 repeats it for every site, and Table 2", "Table 2 splits it by age, and Table 1 again; Table 2")
      .concat("\nTable 1: Sites again\n");
    assert.deepEqual(slipsOf(en, restarted.replace("Table 1 shows recall. ", "Table 2 first. ")), [["order", "Table 1", "Table 2"]]);
  });

  it("reads a Japanese appendix heading the same way", () => {
    const source = "# 昼寝\n\n## 1 結果\n\n表1に結果を示す。表3に全地点を、表2に年齢別を示す。\n\n表1　結果\n\n表2　年齢別\n\n## 付録A 地点\n\n表3　全地点\n";
    assert.deepEqual(slipsOf(ja, source), []);
    assert.deepEqual(slipsOf(ja, source.replace("## 付録A 地点", "## 2 地点")), [["order", "表2", "表3"]]);
  });
});
