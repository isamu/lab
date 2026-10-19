import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { isLinkLabel } from "../packages/chaff/src/detectors/link-label.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// list-item-form-mix: an item that is the words of a link (相談窓口はこちら) is not judged against the sentences around it.
// Every example is self-written.

const RULE = "list-item-form-mix";

const count = (adapter: LanguageAdapter, items: readonly string[]): number =>
  runRules(
    buildDocument("t.md", ["# 題", "", ...items.map((item) => `- ${item}`), ""].join("\n"), adapter),
    loadRules(adapter.id),
    {},
    true,
    "docs/faq",
  ).findings.filter((finding) => finding.rule === RULE).length;

const SENTENCES = ["窓口は市役所の二階にあります。", "受付は平日の九時から始まります。", "予約は電話でも受け付けています。"];

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("list-item-form-mix: the words of a link", () => {
  it("an item ending as a link's words (はこちら) is not judged among sentences", () => {
    assert.equal(count(ja, [...SENTENCES, "相談窓口はこちら"]), 0);
    assert.equal(count(ja, [...SENTENCES, "申込の様式はこちらから"]), 0);
  });

  it("a noun item that is not a link's words is still reported", () => {
    assert.equal(count(ja, [...SENTENCES, "相談窓口の一覧"]), 1);
  });

  it("isLinkLabel reads the end of the words, past closing marks and letter case", () => {
    assert.equal(isLinkLabel("相談窓口はこちら", ["はこちら"]), true);
    assert.equal(isLinkLabel("相談窓口はこちら。", ["はこちら"]), true);
    assert.equal(isLinkLabel("Book online: Click Here.", ["click here"]), true);
    assert.equal(isLinkLabel("「相談窓口はこちら」", ["はこちら"]), true);
    assert.equal(isLinkLabel("Want to book? Click here?", ["click here"]), true);
    assert.equal(isLinkLabel("相談窓口はこちらです。", ["はこちら"]), false);
    assert.equal(isLinkLabel("問題はここ", ["はこちら", "はここをクリック"]), false);
    assert.equal(isLinkLabel("", ["はこちら"]), false);
    assert.equal(isLinkLabel("相談窓口はこちら", [""]), false);
    assert.equal(isLinkLabel("相談窓口はこちら", []), false);
  });
});
