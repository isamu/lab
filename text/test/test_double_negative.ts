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

  it("一つの文に違う二重否定が二つあれば、指摘は一つで、両方を名指す", () => {
    const source = "いまの様式も使えないわけではありませんが、新しい手順で出さないと、承認が遅れないとは限りません。\n";
    assert.deepEqual(findingsOf(source), ["「ないわけではありません」と「ないとは限りません」は二重否定です"]);
    assert.deepEqual(findingsOf("It is not uncommon, and not unlike the old one.\n", en), ['"not uncommon" and "not unlike" are double negatives']);
  });

  it("三つ以上なら数と、初めの二つを名指す", () => {
    const source = "使えないわけではないし、遅れないとは限らないし、出せなくはない。\n";
    assert.deepEqual(findingsOf(source), ["この文に二重否定が 3 つあります（「ないわけではない」「ないとは限らない」ほか）"]);
  });

  it("同じ言い回しを二度使った文は、一つとして名指す", () => {
    assert.deepEqual(findingsOf("行かないわけではないが、来ないわけではない。\n"), ["「ないわけではない」は二重否定です"]);
  });

  it("二重否定が無ければ何も言わない", () => {
    assert.deepEqual(findingsOf("その案に賛成します。\n"), []);
  });
});
