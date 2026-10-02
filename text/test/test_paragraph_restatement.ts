import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { openerOf, repeatedShare } from "../packages/chaff/src/detectors/paragraph-restatement.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// paragraph-restatement: a paragraph that announces a restatement and repeats the one before. Every example is self-written.

const RULE = "paragraph-restatement";

const findingsOf = (adapter: LanguageAdapter, source: string, genre = "blog/tech"): Finding[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.filter((finding) => finding.rule === RULE);

const openersOf = (adapter: LanguageAdapter): string[] => (adapter.lexicons["restating-opener"] ?? []).map((entry) => entry.pattern);

const tokensOf = (adapter: LanguageAdapter, text: string) => adapter.segment(text).sentences.flatMap((sentence) => sentence.tokens ?? []);

const JA_BEFORE = "新しい在庫システムでは、店舗の在庫を一つの画面で数えられます。棚卸しの時間も短くなります。";
const JA_RESTATED = "このように、新しい在庫システムでは店舗の在庫を一つの画面で数えられ、棚卸しの時間が短くなります。";
const EN_BEFORE = "The new inventory system counts every store's stock on one screen, and a stocktake takes less time.";
const EN_RESTATED = "In other words, the new inventory system counts the stock of every store on one screen, so a stocktake takes less time.";

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("openerOf: a paragraph that announces a restatement", () => {
  it("reads Japanese openers, with or without a comma", () => {
    assert.equal(openerOf("このように、在庫を数えます。", openersOf(ja)), "このように、");
    assert.equal(openerOf("このようにして在庫を数えます。", openersOf(ja)), undefined);
    assert.equal(openerOf("つまり在庫を数えます。", openersOf(ja)), "つまり");
    assert.equal(openerOf("在庫を数えます。つまり", openersOf(ja)), undefined);
  });

  it("reads English openers whatever their case, the longest first", () => {
    assert.equal(openerOf("In other words, it counts.", openersOf(en)), "In other words");
    assert.equal(openerOf("To put it simply, it counts.", openersOf(en)), "To put it simply");
    assert.equal(openerOf("  in short, it counts.", openersOf(en)), "in short");
    assert.equal(openerOf("In other words, it counts.", ["in other", "in other words"]), "In other words");
  });

  it("does not read a word that only starts like one", () => {
    assert.equal(openerOf("Essentials of the system.", openersOf(en)), undefined);
    assert.equal(openerOf("That is why we count.", openersOf(en)), undefined);
    assert.equal(openerOf("That is, we count.", openersOf(en)), "That is,");
    assert.equal(openerOf("Overall the focus is stock.", openersOf(en)), undefined);
    assert.equal(openerOf("In shortage of stock, we wait.", openersOf(en)), undefined);
  });
});

describe("repeatedShare: how much of a paragraph the one before already says", () => {
  it("is high for a restatement", () => assert.ok(repeatedShare(tokensOf(ja, JA_BEFORE), tokensOf(ja, JA_RESTATED)).share >= 80));
  it("is low for a paragraph with its own point", () =>
    assert.ok(repeatedShare(tokensOf(ja, JA_BEFORE), tokensOf(ja, "来月から全店で使い始め、最初の棚卸しは四月十日です。")).share < 30));
  it("is 0 with no content words", () => assert.deepEqual(repeatedShare(tokensOf(ja, JA_BEFORE), []), { share: 0, words: 0 }));
});

describe("paragraph-restatement: a paragraph that only says the last one again", () => {
  it("reports a Japanese restatement", () => {
    const findings = findingsOf(ja, `# 在庫\n\n${JA_BEFORE}\n\n${JA_RESTATED}\n`);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.values["opener"], "このように、");
    assert.equal(findings[0]?.line, 5);
  });

  it("reports an English restatement", () => assert.equal(findingsOf(en, `# Stock\n\n${EN_BEFORE}\n\n${EN_RESTATED}\n`).length, 1));

  it("does not report a summary that adds its point", () =>
    assert.deepEqual(findingsOf(ja, `# 在庫\n\n${JA_BEFORE}\n\nこのように、来月から全店で使い始め、最初の棚卸しは四月十日に行います。\n`), []));

  it("does not report a repeat without an opener", () =>
    assert.deepEqual(findingsOf(ja, `# 在庫\n\n${JA_BEFORE}\n\n${JA_RESTATED.replace("このように、", "")}\n`), []));

  it("does not compare across a heading or a list", () => {
    assert.deepEqual(findingsOf(ja, `# 在庫\n\n${JA_BEFORE}\n\n## まとめ\n\n${JA_RESTATED}\n`), []);
    assert.deepEqual(findingsOf(ja, `# 在庫\n\n${JA_BEFORE}\n\n- 項目です。\n\n${JA_RESTATED}\n`), []);
  });

  it("does not run in a transcript", () => assert.deepEqual(findingsOf(ja, `# 在庫\n\n${JA_BEFORE}\n\n${JA_RESTATED}\n`, "speech/transcript"), []));
});
