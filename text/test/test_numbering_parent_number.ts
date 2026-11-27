import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// A two-part number whose first part is not the number of the section it sits in (4.3 inside section 5) is reported.
// Every text is self-written.

const lines = (...rows: string[]): string => rows.join("\n");

const gapsOf = (adapter: LanguageAdapter, source: string): string[] => {
  const rules = loadRules(adapter.id);
  const rule = rules.find((candidate) => candidate.id === "numbering-gap");
  if (rule === undefined) throw new Error("numbering-gap is not loaded");
  return runRules(buildDocument("p.md", source, adapter), rules, {}, true, "business/proposal")
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => messageOf(rule, finding, adapter.id));
};

const section = (heading: string): string[] => [heading, "", "Body text for this part.", ""];

/** The shape of a request for information: section 5 with lettered parts, then a part numbered from another section. */
const request = (third: string): string =>
  lines(
    "# Request for information",
    "",
    ...section("## 4. Data"),
    ...section("## 5. Feedback"),
    ...section("### a. Entity overview"),
    ...section("### b. Idle capacity"),
    ...section(`#### ${third} New capacity`),
    ...section("## 6. Submission"),
  );

describe("numbering-gap: a number whose first part is not its section's", () => {
  it("English: 4.3 inside section 5 is reported", () => {
    assert.deepEqual(gapsOf(en, request("4.3.")), ['"4.3" sits inside "5" (its number should start with "5.")']);
  });

  it("Japanese: the message is in Japanese", () => {
    const source = lines("# 提案依頼", "", ...section("## 4. データ"), ...section("## 5. 意見"), ...section("### 4.3 新しい設備"));
    assert.deepEqual(gapsOf(ja, source), ["「4.3」が「5」の中にあります（番号は「5.」で始まるはず）"]);
  });

  it("valid: 5.1 and 5.2 inside section 5, and a lettered part, are not reported", () => {
    assert.deepEqual(gapsOf(en, request("5.1")), []);
    assert.deepEqual(gapsOf(en, request("c.")), []);
  });

  it("valid: a version (3.0.0) under a numbered section is not a section number", () => {
    const source = lines("# Notes", "", ...section("## 4. History"), ...section("### 3.0.0"), ...section("### 2.6.0"));
    assert.deepEqual(gapsOf(en, source), []);
  });

  it("valid: a dotted number under an unnumbered heading is not compared with an earlier section", () => {
    const source = lines("# Policy", "", ...section("## 4. Procedures"), ...section("### 4.1 Travel"), ...section("## Annex"), ...section("### 2.1 Forms"));
    assert.deepEqual(gapsOf(en, source), []);
  });
});
