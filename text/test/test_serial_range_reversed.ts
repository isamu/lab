import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { labelledRanges, serialRangeEnds } from "../packages/chaff/src/structure/serial-range.ts";

// 製造番号やロットの範囲の終わりが始まりより小さい（serial-range-reversed）。

const RULE = "serial-range-reversed";

const found = (source: string, adapter: LanguageAdapter = en): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/press-release")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => String(finding.values["range"]));

const doc = (...lines: string[]): string => ["# Notice", "", ...lines, ""].join("\n");

describe("serial-range-reversed, Japanese", () => {
  it("a labelled range of codes whose end is below its start", () => {
    assert.deepEqual(found(doc("製造番号：A2400〜A1800"), ja), ["A2400〜A1800"]);
    assert.deepEqual(found(doc("ロット番号：K0430〜K0410"), ja), ["K0430〜K0410"]);
    assert.deepEqual(found(doc("製造ロット L5240－L5210"), ja), ["L5240－L5210"]);
    assert.deepEqual(found(doc("対象は製造番号A2400からA1800までの製品です。"), ja), ["A2400からA1800"]);
  });

  it("a range in order, or with equal ends, is not reported", () => {
    assert.deepEqual(found(doc("製造番号：A1800〜A2400"), ja), []);
    assert.deepEqual(found(doc("ロット番号：K0410〜K0430"), ja), []);
    assert.deepEqual(found(doc("製造番号：A2400〜A2400"), ja), []);
  });

  it("full-width codes are read", () => {
    assert.deepEqual(found(doc("製造番号：Ａ２４００〜Ａ１８００"), ja), ["Ａ２４００〜Ａ１８００"]);
  });

  it("a different series, a list, a change, or a line without a label is not read", () => {
    assert.deepEqual(found(doc("製造番号：A2400〜B0100"), ja), []);
    assert.deepEqual(found(doc("製造番号：A2400、A1800"), ja), []);
    assert.deepEqual(found(doc("製造番号をA2400からA1800に変更しました。"), ja), []);
    assert.deepEqual(found(doc("製造番号はA2400からA1800までに変更しました。"), ja), []);
    assert.deepEqual(found(doc("部品：A-100〜A-099"), ja), []);
    assert.deepEqual(found(doc("製造番号：A2400"), ja), []);
  });
});

describe("serial-range-reversed, English", () => {
  it("a labelled range of codes whose end is below its start", () => {
    assert.deepEqual(found(doc("Serial numbers: B3900 to B3100")), ["B3900 to B3100"]);
    assert.deepEqual(found(doc("Serial numbers SN-1200 to SN-0900")), ["SN-1200 to SN-0900"]);
    assert.deepEqual(found(doc("Lots L5240 through L5210")), ["L5240 through L5210"]);
    assert.deepEqual(found(doc("Lot numbers: L5240–L5210")), ["L5240–L5210"]);
    assert.deepEqual(found(doc("| Batch | B200-B100 |")), ["B200-B100"]);
    assert.deepEqual(found(doc("S/N A1500 to A1200")), ["A1500 to A1200"]);
  });

  it("a range in order is not reported", () => {
    assert.deepEqual(found(doc("Serial numbers: B3100 to B3900")), []);
    assert.deepEqual(found(doc("Lots L5210 through L5240")), []);
  });

  it("codes that differ in letters, hyphen or digits are different series", () => {
    assert.deepEqual(found(doc("Serial numbers: A2400 to B0100")), []);
    assert.deepEqual(found(doc("Serial numbers: SN-1200 to SN0900")), []);
    assert.deepEqual(found(doc("Serial numbers: A2400 to A180")), []);
  });

  it("a list, a change, short codes, or a line without a label is not read", () => {
    assert.deepEqual(found(doc("Serial numbers: A2400, A1800")), []);
    assert.deepEqual(found(doc("The lot was changed from L5240 to L5210.")), []);
    assert.deepEqual(found(doc("Lots A12 to A10")), []);
    assert.deepEqual(found(doc("Replace part A-100 to A-099 in order.")), []);
    assert.deepEqual(found(doc("Lots L5240 and L5210")), []);
  });

  it("a label after the range, or on another line, does not count", () => {
    assert.deepEqual(found(doc("B3900 to B3100 are serial numbers")), []);
    assert.deepEqual(found(doc("Serial numbers:", "", "B3900 to B3100")), []);
  });

  it("a label inside a longer word or identifier does not count", () => {
    assert.deepEqual(found(doc("serial1 A2400-A1800")), []);
    assert.deepEqual(found(doc("batch_id B200-B100")), []);
    assert.deepEqual(found(doc("Allotment A2400-A1800")), []);
  });
});

describe("serial codes as range ends", () => {
  it("reads letters, hyphen and digit count as the series, the digits as the value", () => {
    const [first, second] = serialRangeEnds("SN-1200 to SN-0900");
    assert.equal(first?.currency, second?.currency);
    assert.equal(first?.value, 1200);
    assert.equal(second?.value, 900);
  });

  it("does not read a code inside a word or a longer number, or one with too few digits", () => {
    assert.deepEqual(serialRangeEnds("XA2400B ISO9001x A12 1A2400"), []);
    assert.deepEqual(serialRangeEnds(""), []);
  });

  it("keeps only issues with a label before them on their line", () => {
    const text = "Lot A200 to A100\nA200 to A100 lot";
    const issues = [
      { offset: 4, values: {} },
      { offset: 17, values: {} },
    ];
    assert.deepEqual(
      labelledRanges(text, issues, ["lot"]).map((issue) => issue.offset),
      [4],
    );
    assert.deepEqual(labelledRanges(text, issues, []), []);
  });
});
