import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// ai-tell sums the weights of the phrases a document holds; these entries are low-weight, so only several together
// reach the limit. Self-written samples.

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

const aiTell = (source: string, adapter: LanguageAdapter, genre = "blog/essay") =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.filter((finding) => finding.rule === "ai-tell");

/** The phrases ai-tell holds in a source when any score is reported (limit 0). */
const phrasesAtAnyScore = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "blog/essay", { "ai-tell": 0 })
    .findings.filter((finding) => finding.rule === "ai-tell")
    .map((finding) => String(finding.values["word"]));

describe("ai-tell: era words and honesty markers (en)", () => {
  it("reports several of them in one post", () => {
    const source =
      "# Notes\n\nThe essay delves into the garden. Garnering praise is not the goal. The effort was commendable, if I'm being honest. The camaraderie lasted.\n";
    assert.equal(aiTell(source, en).length, 1);
  });

  it("matches each inflected form it lists", () => {
    assert.equal(aiTell("# Notes\n\nShe delved into it. He delves into it. We are delving into it. It garners praise.\n", en).length, 1);
  });

  it("leaves one of them alone, and leaves the words human business text uses", () => {
    assert.deepEqual(aiTell("# Notes\n\nThe door closed quietly.\n", en), []);
    const business =
      "# Plan\n\nWe ensure a robust, comprehensive plan to enhance and leverage what is essential, effective and significant. Progress was steady.\n";
    assert.deepEqual(aiTell(business, en, "business/report"), []);
  });
});

describe("ai-tell: closings, set metaphors and calques (ja)", () => {
  it("reports several of them in one post", () => {
    const source =
      "# 散歩\n\n歩くと理解が深まります。それでも、続けました。地図は羅針盤です。人と人の橋渡しになります。この言葉は刺さりました。順に見ていきましょう。\n";
    assert.equal(aiTell(source, ja).length, 1);
  });

  it("leaves one of them alone", () => {
    assert.deepEqual(aiTell("# 散歩\n\nそれでも、朝は歩きました。\n", ja), []);
  });

  it("leaves the words human documents use as much (最後に, さまざまな, 車の両輪, 伴走, 寄り添う)", () => {
    const source =
      "# 報告\n\n最後に、さまざまな支援において適切な対応が重要です。両者は車の両輪です。伴走支援で寄り添い、課題に向き合います。言語化も進めました。\n";
    assert.deepEqual(aiTell(source, ja, "business/report"), []);
  });
});

describe("ai-tell: honesty inside a sentence, a request recast as a benefit (ja)", () => {
  it("adds 正直 after a comma and にとっても有意義 to the other phrases", () => {
    const source =
      "# 件名\n\nご提案をいただき、正直かなり迷いました。延期すれば、皆様にとっても有意義な場になります。この言葉は刺さりました。順に見ていきましょう。理解が深まります。工場との橋渡しもします。\n";
    const [finding] = aiTell(source, ja, "business/email");
    assert.match(String(finding?.values["word"]), /、正直/u);
    assert.match(String(finding?.values["word"]), /にとっても有意義/u);
  });

  it("leaves 正直 at the head of a sentence (announcing-opener's), in an answer, and as a noun", () => {
    const source = "# 答弁\n\n正直、迷いました。やはり正直申し上げますと、難しい。彼は正直者だ。それが正直なところです。理解が深まります。\n";
    assert.deepEqual(phrasesAtAnyScore(source, ja), ["理解が深まる"]);
  });
});

describe("ai-tell: stock phrases of a generated guide (en)", () => {
  it("adds the golden rule of and a powerful solution to the other phrases", () => {
    const source =
      "# Backups\n\nFirst, the golden rule of backups. A NAS is a powerful solution for families. The setup is commendable, if I'm being honest. It delves into the details.\n";
    const [finding] = aiTell(source, en, "blog/tech");
    assert.match(String(finding?.values["word"]), /the golden rule of/u);
    assert.match(String(finding?.values["word"]), /a powerful solution/u);
  });

  it("leaves one of them alone", () => {
    assert.deepEqual(aiTell("# Backups\n\nKeep three copies: the golden rule of backups.\n", en, "blog/tech"), []);
  });
});
