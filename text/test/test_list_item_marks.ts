import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// list-item-form-mix: marks after an item's last word (!!, a footnote reference), a headline's あり / なし, and a lead-in
// item ending in a colon. Every example is self-written.

const RULE = "list-item-form-mix";

const flagged = (adapter: LanguageAdapter, source: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "blog/tech")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${finding.variant ?? ""}:${String(finding.values["written"])}`);

const list = (...items: string[]): string => ["# 題", "", ...items.map((item) => "- " + item), ""].join("\n");

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("list-item-form-mix: marks after the last word are not words", () => {
  it("reads 「公募します!!」 as a sentence, not as a noun", () => {
    assert.deepEqual(flagged(ja, list("会場が決まりました", "発表を公募します!!", "参加費を集めます", "懇親会の準備")), ["ending-phrase:懇親会の準備"]);
  });

  it("reads past a footnote reference to the item's last word", () => {
    assert.deepEqual(flagged(ja, list("会場が決まりました", "発表を募集します", "参加費を集めます", "懇親会の申込は来月 [^1]")), [
      "ending-phrase:懇親会の申込は来月 [^1]",
    ]);
    const defined = `${list("会場の予約", "発表の募集", "参加費の集金", "懇親会を開きます [^1]")}\n[^1]: 会場は追って知らせます。\n`;
    const found = flagged(ja, defined);
    assert.equal(found.length, 1);
    assert.ok(found[0]?.startsWith("ending-sentence:懇親会を開きます"));
    assert.deepEqual(flagged(ja, list("会場の予約", "発表の募集", "参加費の集金", "懇親会を開きます [^1]")), ["ending-sentence:懇親会を開きます [^1]"]);
  });
});

describe("list-item-form-mix: a headline's あり / なし after a noun is a phrase", () => {
  it("does not flag 翻訳あり or 駐車場なし among noun endings", () => {
    assert.deepEqual(flagged(ja, list("全発表に翻訳あり", "会場は駅から徒歩5分", "昼食の提供", "近くの駐車場なし")), []);
  });

  it("still flags a clause that ends in あり after a particle, and a sentence among headlines", () => {
    assert.deepEqual(flagged(ja, list("会場の予約", "発表の募集", "参加費の集金", "懇親会の会場に問題があり")), ["ending-sentence:懇親会の会場に問題があり"]);
    assert.deepEqual(flagged(ja, list("全発表に翻訳あり", "昼食の提供", "託児室あり", "懇親会を開きます")), ["ending-sentence:懇親会を開きます"]);
  });
});

describe("list-item-form-mix: an item ending in a colon leads into what follows", () => {
  const items = [
    "The parser reads the file.",
    "The renderer draws the page.",
    "The exporter writes the archive.",
    "The checker validates the output.",
  ];

  it("does not judge a lead-in item for a nested list", () => {
    const source = ["# Title", "", ...items.map((item) => `- ${item}`), "- Other kinds of output:", "  - The printer prints a copy.", ""].join("\n");
    assert.deepEqual(flagged(en, source), []);
  });

  it("still flags a phrase without the colon", () => {
    const source = ["# Title", "", ...items.map((item) => `- ${item}`), "- Other kinds of output", ""].join("\n");
    assert.deepEqual(flagged(en, source), ["ending-phrase:Other kinds of output"]);
  });
});
