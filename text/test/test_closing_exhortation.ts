import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { exhortationIn, exhortationWords } from "../packages/chaff/src/detectors/closing-exhortation.ts";
import { tokenizedLexicons } from "../packages/chaff/src/lexicon-tokens.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LanguageAdapter, Level } from "../packages/chaff/src/plugin.ts";

// closing-exhortation: the closing of a post cheers the reader on or promises the outcome. One is ordinary; two in the
// closing are the stock ending. Self-written samples.

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

const findings = (source: string, adapter: LanguageAdapter, level?: Level, genre = "blog/essay") =>
  runRules(
    buildDocument("t.md", source, adapter),
    loadRules(adapter.id),
    level === undefined ? {} : { "closing-exhortation": level },
    true,
    genre,
  ).findings.filter((finding) => finding.rule === "closing-exhortation");

const sentenceOf = (adapter: LanguageAdapter, text: string) => {
  const doc = buildDocument("t.md", text, adapter);
  const sentence = doc.sentences[0];
  assert.ok(sentence !== undefined);
  return sentence;
};

const lexiconOf = (adapter: LanguageAdapter) => exhortationWords(tokenizedLexicons(adapter.lexicons, adapter)["closing-exhortation"] ?? []);

describe("exhortationIn", () => {
  const cheering: ReadonlyArray<readonly [LanguageAdapter, string]> = [
    [ja, "ぜひ一度、試してみてください。"],
    [ja, "ぜひ、毎朝の習慣にしましょう。"],
    [ja, "きっと、いつもの街が少し違って見えるはずだ。"],
    [ja, "一度、家の周りを歩いてみてほしい。"],
    [en, "You've got this."],
    [en, "Happy baking!"],
    [en, "Happy baking!”"],
  ];
  cheering.forEach(([adapter, text]) => {
    it(`finds 「${text}」`, () => assert.notEqual(exhortationIn(sentenceOf(adapter, text), lexiconOf(adapter)), undefined));
  });

  const plain: ReadonlyArray<readonly [LanguageAdapter, string]> = [
    [ja, "ぜひご検討ください。"],
    [ja, "はずの部品が届きました。きっと"],
    [ja, "明日は雨のはずです。"],
    [en, "I'm happy to help!"],
    [en, "Happy customers came back."],
  ];
  plain.forEach(([adapter, text]) => {
    it(`does not find 「${text}」`, () => assert.equal(exhortationIn(sentenceOf(adapter, text), lexiconOf(adapter)), undefined));
  });
});

describe("closing-exhortation", () => {
  const JA_POST =
    "# 朝の散歩\n\n朝の散歩を半年続けました。\n\nもし朝の時間をもてあましているなら、一度、家の周りを歩いてみてほしい。きっと、いつもの街が少し違って見えるはずだ。\n";

  it("reports two cheering lines in the closing", () => {
    assert.equal(findings(JA_POST, ja).length, 2);
    assert.equal(findings("# Bread\n\nI baked bread every week.\n\nYou've got this. Happy baking!\n", en).length, 2);
  });

  it("leaves one alone at normal, and reports it at strict", () => {
    const one = "# 朝の散歩\n\n朝の散歩を半年続けました。\n\n起きる時刻が早くなりました。きっと続けられるはずです。\n";
    assert.deepEqual(findings(one, ja), []);
    assert.equal(findings(one, ja, "strict").length, 1);
  });

  it("leaves cheering outside the closing alone", () => {
    const early = [
      "# 散歩",
      "",
      "ぜひ一度、試してみてください。きっと楽しいはずです。",
      "",
      "## 半年後",
      "",
      "半年で起きる時刻が 30 分早くなった。",
      "",
      "## 結果",
      "",
      "体重は変わらなかった。",
      "",
    ].join("\n");
    assert.deepEqual(findings(early, ja), []);
  });

  it("leaves a business letter's ordinary closing alone", () => {
    assert.deepEqual(findings("# ご提案\n\n概要は以上です。\n\nぜひご検討ください。よろしくお願いいたします。\n", ja, undefined, "business/proposal"), []);
  });
});
