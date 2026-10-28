import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// honesty-marker: one "honestly" / 正直 flagging a sentence as candid is reported alone, in blogs and business
// documents only. Self-written samples.

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

const RULE = "honesty-marker";

const runOn = (source: string, adapter: LanguageAdapter, genre: string) =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre);

const matched = (source: string, adapter: LanguageAdapter, genre = "blog/essay"): string[] =>
  runOn(source, adapter, genre)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => String(finding.values["matched"]));

describe("honesty-marker (en)", () => {
  it("reports one marker alone in a blog post", () => {
    assert.deepEqual(matched("# Letters\n\nI still write letters, if I'm honest. Not because email is bad.\n", en), ["if I'm honest"]);
    assert.deepEqual(matched("# Cafés\n\nAnd honestly? The barista knows my order.\n", en), ["honestly?"]);
    assert.deepEqual(matched("# Editors\n\nNotes, even grocery lists, if I'm being honest.\n", en, "blog/tech"), ["if I'm being honest"]);
    assert.deepEqual(matched("# Headphones\n\nHere's my honest take on what they get right.\n", en), ["my honest take"]);
  });

  it("reports it in a business document", () => {
    assert.deepEqual(matched("# Offer\n\nHonestly, we were torn about the proposal.\n", en, "business/email"), ["honestly,"]);
  });

  it("leaves honestly as a manner adverb, and the word only named", () => {
    assert.deepEqual(matched("# Taxes\n\nThey live honestly and pay what they owe.\n", en), []);
    assert.deepEqual(matched('# Words\n\nThe word "honestly" is overused in reviews.\n', en), []);
  });

  it("does not run in a paper", () => {
    const result = runOn("# Reviewers\n\nHonestly, the fee did not change the reviews.\n", en, "academic/paper");
    assert.ok(result.skipped.some((skip) => skip.rule === RULE));
    assert.ok(!result.findings.some((finding) => finding.rule === RULE));
  });
});

describe("honesty-marker (ja)", () => {
  it("reports one marker alone in a blog post", () => {
    assert.deepEqual(matched("# 散歩\n\n最初の1週間は、正直つらかった。\n", ja), ["、正直"]);
    assert.deepEqual(matched("# 仕事\n\n正直に言うと、途中でわからなくなっていた。\n", ja), ["正直に言うと"]);
    assert.deepEqual(matched("# 町\n\n最初は、正直なところ少し重たく感じていた。\n", ja), ["、正直"]);
  });

  it("reports it in a business email", () => {
    assert.deepEqual(matched("# ご提案の件\n\nご提案には、正直かなり迷いました。\n", ja, "business/email"), ["、正直"]);
  });

  it("leaves 正直 as a trait, and 正直なところ opening a sentence (people write it too)", () => {
    assert.deepEqual(matched("# 研修\n\n彼は正直者だ。眠くなったという正直な声が多かった。\n", ja, "business/report"), []);
    assert.deepEqual(matched("# CI\n\n正直なところ、三週間ほど放っておきました。\n", ja, "blog/tech"), []);
  });

  it("does not run in a paper", () => {
    const result = runOn("# 査読\n\n正直なところ、謝礼で査読は変わらなかった。\n", ja, "academic/paper");
    assert.ok(result.skipped.some((skip) => skip.rule === RULE));
  });
});
