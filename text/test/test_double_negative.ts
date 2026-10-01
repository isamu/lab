import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 二重否定（double-negative）。例文はすべて自作。

const RULE = "double-negative";

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const findingsOf = (source: string, adapter = ja, genre = "business/report"): readonly string[] => namedRuleRun(RULE, source, adapter, "a.md", genre).findings;

describe("double-negative: 二重否定", () => {
  it("「〜ないわけではない」「〜ないことはない」", () => {
    assert.deepEqual(findingsOf("その案に賛成しないわけではありません。\n"), ["「ないわけではありません」は二重否定です"]);
    assert.deepEqual(findingsOf("今週中に終わらないことはない。\n"), ["「ないことはない」は二重否定です"]);
  });

  it("過去の形（なかった）も語彙表に並べてある", () => {
    assert.deepEqual(findingsOf("当時も予算を出さないわけではなかった。\n"), ["「ないわけではなかった」は二重否定です"]);
  });

  it("英語の文書は英語で言う", () => {
    assert.deepEqual(findingsOf("Delays are not uncommon in spring.\n", en), ['"not uncommon" is a double negative']);
  });

  it("決まった言い方（ざるを得ない、なければならない、not without）は数えない", () => {
    assert.deepEqual(findingsOf("延期せざるを得ない。期限までに出さなければならない。\n"), []);
    assert.deepEqual(findingsOf("Do not enter without a badge.\n", en), []);
  });

  it("法令・文学・話し言葉のジャンルは既定で止める", () => {
    const source = "その案に賛成しないわけではありません。\n";
    assert.ok(firedRules(ja, source, "business/report").includes(RULE));
    ["legal/contract", "literature/fiction", "speech/address"].forEach((genre) => assert.ok(!firedRules(ja, source, genre).includes(RULE), genre));
  });

  it("二重否定が無ければ何も言わない", () => {
    assert.deepEqual(findingsOf("その案に賛成します。\n"), []);
  });
});
