import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { ellipsesIn } from "../packages/chaff/src/detectors/ellipsis.ts";

// 省略記号の書き方の混在（ellipsis-consistency）。例文はすべて自作。

const RULE = "ellipsis-consistency";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, `${source}\n`, adapter).findings;

describe("ellipsis-consistency: 省略記号の書き方の混在", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("少ないほうの書き方を指す", () => {
    assert.deepEqual(findingsOf("準備中です……。確認中です……。少々お待ちください・・・。"), [
      "省略の記号を「・・・」と書いています（この文書はふつう「……」。3 箇所のうち 1 箇所が違う）",
    ]);
    assert.deepEqual(findingsOf("Loading… Saving… Please wait...", en), ['The ellipsis "..." here, where the document usually writes "…" (1 of 3)']);
  });

  it("一通りで書いた文書、同じ数の二通り、使い分けている文書は指さない", () => {
    assert.deepEqual(findingsOf("準備中です……。確認中です……。"), []);
    assert.deepEqual(findingsOf("Loading… Please wait...", en), []);
    assert.deepEqual(findingsOf("Loading... Saving... Please wait...", en), []);
  });

  it("コードの中の点は数えない", () => {
    assert.deepEqual(findingsOf("Loading… Saving… Run `npm install ...` now.", en), []);
  });

  it("ranges, paths, addresses and table of contents leaders are not ellipses", () => {
    const forms = ["…", "...", "・・・"];
    assert.deepEqual(ellipsesIn("Use 1...10.", forms), []);
    assert.deepEqual(ellipsesIn("See https://example.com/a...b now.", forms), []);
    assert.deepEqual(ellipsesIn("Open docs/.../index.md now.", forms), []);
    assert.deepEqual(ellipsesIn("Contents\nIntro ... 12\nUsage ... 14\n", forms), []);
    assert.deepEqual(ellipsesIn("第1章・・・3", forms), []);
    assert.deepEqual(findingsOf("Loading… Saving… Use 1...10 and see https://example.com/a...b.", en), []);
  });

  it("reads each form whole, longest first, and skips longer runs of dots", () => {
    const forms = ["……", "…", "・・・", "..."];
    assert.deepEqual(
      ellipsesIn("待つ……。待つ…。待つ・・・。", forms).map((ellipsis) => ellipsis.form),
      ["……", "…", "・・・"],
    );
    assert.deepEqual(ellipsesIn("Wait.... Then go.", ["..."]), []);
    assert.deepEqual(ellipsesIn("Wait...", []), []);
    assert.deepEqual(ellipsesIn("", forms), []);
  });
});
