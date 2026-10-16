import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";
import { nextLabelOf } from "../packages/chaff/src/structure/repeated-number.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// A number written twice where the next one skips (4.1, 4.1, 4.3) is one mistake: the second should be 4.2.
// It is reported once, at the second, and not also as a gap at the next. Every text is self-written.

const lines = (...rows: string[]): string => rows.join("\n");

const gapsOf = (adapter: LanguageAdapter, source: string): string[] => {
  const rules = loadRules(adapter.id);
  const rule = rules.find((candidate) => candidate.id === "numbering-gap");
  if (rule === undefined) throw new Error("numbering-gap is not loaded");
  return runRules(buildDocument("p.md", source, adapter), rules, {}, true, "legal/contract")
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => messageOf(rule, finding, adapter.id));
};

const section = (heading: string): string[] => [heading, "", "Body text for this part.", ""];

/** The shape of a travel policy: 4.1 under section 4, then 4.1 again, an unnumbered level-2 heading, then 4.3. */
const splitPolicy = (second: string): string =>
  lines(
    "# Expense policy",
    "",
    ...section("## 3. General"),
    ...section("## 4. Procedures"),
    ...section("### 4.1 Travel expenses"),
    ...section("### Car rental"),
    ...section(`### ${second} Other expenses`),
    ...section("## Approved supplies list"),
    ...section("### Office supplies"),
    ...section("### 4.3 Missing receipts"),
    ...section("### 4.4 Payout timelines"),
    ...section("## 5. Cards"),
  );

const flat = (...numbers: string[]): string =>
  lines("# Expense policy", "", ...section("## 2. Scope"), ...numbers.flatMap((number, index) => section(`### ${number} Part ${String(index + 1)}`)));

describe("a number written twice, then a skip", () => {
  it("English: 4.1, 4.1 under section 4, then 4.3 under another heading — the second 4.1 is probably 4.2", () => {
    assert.deepEqual(gapsOf(en, splitPolicy("4.1")), ['"4.1" appears twice and the next number skips; the second is probably "4.2"']);
  });

  it("English: correctly numbered, the same document has no finding", () => {
    assert.deepEqual(gapsOf(en, splitPolicy("4.2")), []);
  });

  it("English: 2.1, 2.2, 2.2, 2.4 under one parent is one finding at the second 2.2, not a repeat and a gap", () => {
    assert.deepEqual(gapsOf(en, flat("2.1", "2.2", "2.2", "2.4")), ['"2.2" appears twice and the next number skips; the second is probably "2.3"']);
  });

  it("English: Article 1, Article 1, Article 3 is one finding, not a gap at Article 3", () => {
    const source = lines("# Rules", "", ...section("## Article 1 Purpose"), ...section("## Article 1 Scope"), ...section("## Article 3 Hours"));
    assert.deepEqual(gapsOf(en, source), ['"Article 1" appears twice and the next number skips; the second is probably "Article 2"']);
  });

  it("日本語: 第2条、第2条、第4条は、二つ目の第2条で一度だけ言う", () => {
    const source = lines(
      "# 就業規則",
      "",
      "## 第1条（目的）",
      "",
      "この規則は働き方を定める。",
      "",
      "## 第2条（適用）",
      "",
      "社員に適用する。",
      "",
      "## 第2条（勤務時間）",
      "",
      "勤務時間は九時から六時までとする。",
      "",
      "## 第4条（休日）",
      "",
      "休日は土曜日と日曜日とする。",
    );
    const found = gapsOf(ja, source);
    assert.equal(found.length, 1);
    assert.match(found[0] ?? "", /二度あり/u);
  });
});

describe("what stays as it was", () => {
  it("a real gap with no repeat is still a gap: 2.1, 2.2, 2.4", () => {
    assert.deepEqual(gapsOf(en, flat("2.1", "2.2", "2.4")), ['"2.4" follows "2.2" (expected number 3)']);
  });

  it("a repeat whose next number does not skip is the plain repeat it was: 2.1, 2.2, 2.2, 2.3", () => {
    assert.deepEqual(gapsOf(en, flat("2.1", "2.2", "2.2", "2.3")), ['"2.2" follows "2.2" (expected number 3)']);
  });

  it("two parts that each number from 1.1 are not a repeat", () => {
    const source = lines(
      "# Handbook",
      "",
      ...section("## Part A"),
      ...section("### 1.1 Joining"),
      ...section("### 1.2 Leaving"),
      ...section("### 1.3 Moving"),
      ...section("## Part B"),
      ...section("### 1.1 Joining"),
      ...section("### 1.2 Leaving"),
      ...section("### 1.3 Moving"),
    );
    assert.deepEqual(gapsOf(en, source), []);
  });

  it("the same number under two different parents is not a repeat, even when a skip follows", () => {
    const source = lines(
      "# Handbook",
      "",
      ...section("## Part A"),
      ...section("### 4.1 Joining"),
      ...section("## Part B"),
      ...section("### 4.1 Joining"),
      ...section("### 4.3 Moving"),
    );
    assert.deepEqual(gapsOf(en, source), ['"4.3" follows "4.1" (expected number 2)']);
  });

  it("4.1 twice in one section, then 4.1 and 4.3 in another, is the plain gap it was, not a repeat", () => {
    const source = lines(
      "# Handbook",
      "",
      ...section("## Part A"),
      ...section("### 4.1 Joining"),
      ...section("### 4.1 Leaving"),
      ...section("## Part B"),
      ...section("### 4.1 Joining"),
      ...section("### 4.3 Moving"),
    );
    assert.deepEqual(gapsOf(en, source), ['"4.3" follows "4.1" (expected number 2)']);
  });

  it("a changelog's version headings are not a repeat: 3.1.0, 3.1.0, 3.1.2", () => {
    const source = lines("# Changelog", "", ...section("## 3.1.0"), ...section("## 3.1.0"), ...section("## 3.1.2"));
    assert.deepEqual(gapsOf(en, source), []);
  });

  it("an HTML block between the second and the next may hold the skipped number, so the repeat is not named", () => {
    const source = lines(
      "# Expense policy",
      "",
      ...section("## 2. Scope"),
      ...section("### 2.1 Part 1"),
      ...section("### 2.2 Part 2"),
      ...section("### 2.2 Part 3"),
      "<br/>",
      "### 2.3 Hidden part",
      "",
      ...section("### 2.4 Part 4"),
    );
    assert.deepEqual(gapsOf(en, source), ['"2.2" follows "2.2" (expected number 3)']);
  });

  it("two bracketed lists in one article that both start at (1) are not a repeat", () => {
    const source = lines(
      "# 規程",
      "",
      "## 第1条（届出）",
      "",
      "次の事項を届け出る。",
      "",
      "（1）氏名",
      "（2）住所",
      "",
      "次の書類を添える。",
      "",
      "（1）写真",
      "（2）証明書",
      "（3）印鑑",
    );
    assert.deepEqual(gapsOf(ja, source), []);
  });
});

describe("the number the second one probably should have", () => {
  it("advances the last number written in figures", () => {
    assert.deepEqual(
      [nextLabelOf("4.1", 1), nextLabelOf("Section 2", 2), nextLabelOf("第2条", 2), nextLabelOf("4．1", 1), nextLabelOf("12.9", 9)],
      ["4.2", "Section 3", "第3条", "4.2", "12.10"],
    );
  });

  it("falls back to the bare number when the label is not written in the same figures", () => {
    assert.deepEqual([nextLabelOf("第二条", 2), nextLabelOf("(b)", 2), nextLabelOf("", 1)], ["3", "3", "2"]);
  });
});
