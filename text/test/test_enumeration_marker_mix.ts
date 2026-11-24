import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { enumerationRuns } from "../packages/chaff/src/enumeration-marks.ts";

// Item numbers written in mixed forms in one run. Self-written examples.

const run = (source: string, adapter = ja, path = "a.md"): readonly string[] => namedRuleRun("enumeration-marker-mix", `${source}\n`, adapter, path).findings;

const runs = (source: string): string[][] => enumerationRuns(source).map((items) => items.map((item) => `${item.form}=${String(item.value)}`));

describe("enumerationRuns", () => {
  it("reads each item's form and number", () => {
    assert.deepEqual(runs("1. a\n2) b\n(3) c\n④ d\n五、e\nf. f\n(vii) g\n⑻ h\n"), [
      ["arabic:dot=1", "arabic:close=2", "arabic:paren=3", "circled=4", "kanji:comma=5", "lower-letter:dot=6", "lower-roman:paren=7", "paren-sign=8"],
    ]);
  });

  it("reads full-width numbers as their half-width forms", () => {
    assert.deepEqual(runs("１．あ\n（２）い\n"), [["arabic:dot=1", "arabic:paren=2"]]);
  });

  it("reads a single i, v or x by the item before it", () => {
    assert.deepEqual(runs("(h) a\n(i) b\n"), [["lower-letter:paren=8", "lower-letter:paren=9"]]);
    assert.deepEqual(runs("(iv) a\n(v) b\n"), [["lower-roman:paren=4", "lower-roman:paren=5"]]);
    assert.deepEqual(runs("(i) a\n(ii) b\n"), [["lower-roman:paren=1", "lower-roman:paren=2"]]);
  });

  it("splits runs at a heading, an unnumbered paragraph and a deeper indentation", () => {
    assert.deepEqual(runs("1. a\n## b\n2. c\n"), [["arabic:dot=1"], ["arabic:dot=2"]]);
    assert.deepEqual(runs("1. a\n\nNote.\n\n2. c\n"), [["arabic:dot=1"], ["arabic:dot=2"]]);
    assert.deepEqual(runs("1. a\n   (1) b\n2. c\n"), [["arabic:paren=1"], ["arabic:dot=1", "arabic:dot=2"]]);
  });

  it("keeps an item's own text and blank lines inside the run", () => {
    assert.deepEqual(runs("1. a\nmore of a\n\n2. b\n\n   still b\n\n3. c\n"), [["arabic:dot=1", "arabic:dot=2", "arabic:dot=3"]]);
  });

  it("does not read numbers without a delimiter, decimals or abbreviations as items", () => {
    assert.deepEqual(runs("2　乙は\n3.5 million\ne.g. this\n2026年の計画\n"), []);
  });
});

describe("enumeration-marker-mix", () => {
  it("reports an item that changes form partway through a run", () => {
    assert.deepEqual(run("手順です。\n\n1. 申込書を書く\n2. 写真を貼る\n3) 窓口に出す\n4. 受付票を受け取る"), [
      "番号「3)」の書き方が、同じ並びのほかの番号（「1.」など 3 個）と違います",
    ]);
    assert.deepEqual(run("To apply:\n\n1. Fill in the form.\n2. Attach a photo.\n3) Hand it in.\n4. Keep the receipt.", en), [
      'The item number "3)" is written differently from the rest of its run ("1." and 3 in all)',
    ]);
  });

  it("reports mixed forms in numbered paragraphs, in plain text too", () => {
    assert.deepEqual(run("(1) 甲は、代金を払う。\n(2) 乙は、品物を渡す。\n3. 甲及び乙は、協議する。", ja, "a.txt"), [
      "番号「3.」の書き方が、同じ並びのほかの番号（「(1)」など 2 個）と違います",
    ]);
    assert.deepEqual(run("① 準備する\n② 確かめる\n3. 片付ける\n④ 報告する"), ["番号「3.」の書き方が、同じ並びのほかの番号（「①」など 3 個）と違います"]);
    assert.deepEqual(run("(a) the Tenant;\n(b) the Landlord;\nc. the Agent.", en), [
      'The item number "c." is written differently from the rest of its run ("(a)" and 2 in all)',
    ]);
  });

  it("reports an odd first item that the run counts on from", () => {
    assert.deepEqual(run("1) 申込書を書く\n2. 写真を貼る\n3. 窓口に出す"), ["番号「1)」の書き方が、同じ並びのほかの番号（「2.」など 2 個）と違います"]);
  });

  it("does not report a sub-list that counts from 1 again", () => {
    assert.deepEqual(run("1. 準備\n(1) 道具\n(2) 材料\n2. 作業\n3. 片付け"), []);
    assert.deepEqual(run("1. 準備\na. 道具\nb. 材料\n2. 作業\n3. 片付け"), []);
  });

  it("does not report the upper level of a flat layout whose sub-items outnumber it", () => {
    const flat =
      "(1) The Tenant must:\n(a) pay the rent;\n(b) keep the flat clean.\n(2) The Landlord must:\n(a) repair the roof;\n(b) insure the building.\n(3) Either may end the lease.";
    assert.deepEqual(run(flat, en, "a.txt"), []);
    assert.deepEqual(run("① 書類を出す\n② 印を押す\n③ 写しを取る\n4. 控えを残す\n① 受け取る\n5. 保管する"), []);
  });

  it("does not report numbers that do not count on, ties, or short runs", () => {
    assert.deepEqual(run("1. a\n2. b\n(5) c\n6. d"), []);
    assert.deepEqual(run("1. a\n2) b\n3. c\n4) d"), []);
    assert.deepEqual(run("1. a\n2) b"), []);
  });

  it("does not compare separate runs or numbers in code, quotations and headings", () => {
    assert.deepEqual(run("1. a\n2. b\n\n説明です。\n\n3) c\n4) d"), []);
    assert.deepEqual(run("1. a\n2. b\n\n```\n3) c\n```\n"), []);
    assert.deepEqual(run("1. a\n2. b\n> 3) c\n4. d"), []);
    assert.deepEqual(run("## 1. 概要\n\n## 2. 手順\n\n## 3) 費用\n"), []);
  });

  it("does not report a run written in one form", () => {
    assert.deepEqual(run("1. a\n2. b\n3. c\n4. d", en), []);
    assert.deepEqual(run("一、総則\n二、定義\n三、適用"), []);
  });
});
