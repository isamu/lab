import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

const RULES = loadRules("ja");

const idsFor = (source: string, experimental = false): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, {}, experimental, "blog/tech").findings.map((finding) => finding.rule);

const sentences = (count: number, size: number): string => Array.from({ length: count }, () => `${"あ".repeat(size)}。`).join("");

describe("bold-density", () => {
  // 密度で測る。短い節は対象外（200 字未満）。
  const padded = (bolds: number, chars: number): string => {
    const runs = Array.from({ length: bolds }, (__x, index) => `**${index}**`).join("");
    return `## 節\n\n${runs}${"あ".repeat(chars)}。`;
  };

  it("invalid: 1000 字あたり 20 箇所を超える", () => {
    assert.ok(idsFor(padded(10, 300)).includes("bold-density"));
  });
  it("valid: 同じ太字の数でも、節が長ければ指摘しない", () => {
    // 件数で数えていたときは、長い節ほど当たっていた。読者の印象と逆だった。
    assert.ok(!idsFor(padded(10, 2000)).includes("bold-density"));
  });
  it("valid: 短い節は測らない", () => {
    // 43 字に 1 箇所で「1000 字あたり 23」になる。密度が暴れる。
    assert.ok(!idsFor("## 節\n\n**a** です。").includes("bold-density"));
  });
  it("valid: コードブロックの ** は太字ではない", () => {
    // 誤検知しやすい正常な文章。Markdown 以外の ** を太字と数えない。
    assert.ok(!idsFor("## 節\n\n```\n**a** **b** **c** **d**\n```\n\n普通の文です。").includes("bold-density"));
  });
});

describe("max-sentence-length", () => {
  it("invalid: 100 文字を超える文", () => {
    assert.ok(idsFor(`${"あ".repeat(120)}。`).includes("max-sentence-length"));
  });
  it("valid: 100 文字ちょうどは通す", () => {
    assert.ok(!idsFor(`${"あ".repeat(99)}。`).includes("max-sentence-length"));
  });
  it("valid: 長いコードブロックは文ではない", () => {
    // 誤検知しやすい正常な文章。これを数えると全ての技術記事が落ちる。
    assert.ok(!idsFor(`短い文です。\n\n\`\`\`\n${"x".repeat(300)}\n\`\`\``).includes("max-sentence-length"));
  });
  it("valid: 長い表の行は文ではない", () => {
    assert.ok(!idsFor(`短い文です。\n\n| ${"あ".repeat(200)} | b |\n| --- | --- |\n| 1 | 2 |`).includes("max-sentence-length"));
  });
});

describe("heading-echo", () => {
  it("invalid: 見出しを直後の文がほぼ繰り返す", () => {
    assert.ok(idsFor("## キャッシュの仕組み\n\nキャッシュの仕組みについて説明します。").includes("heading-echo"));
  });
  it("valid: 見出しの中身から書き始めている", () => {
    assert.ok(!idsFor("## キャッシュの仕組み\n\nTTL が切れるまで、同じ応答を返し続けます。").includes("heading-echo"));
  });
  it("valid: 見出しが無い節では動かない", () => {
    assert.ok(!idsFor("見出しのない文章です。").includes("heading-echo"));
  });
});

describe("repeated-sentence-head", () => {
  it("invalid: 同じ書き出しが 4 文続く", () => {
    assert.ok(idsFor("そしてこれは一です。そしてこれは二です。そしてこれは三です。そしてこれは四です。").includes("repeated-sentence-head"));
  });
  it("valid: 3 文までは通す", () => {
    assert.ok(!idsFor("そしてこれは一です。そしてこれは二です。そしてこれは三です。").includes("repeated-sentence-head"));
  });
  it("valid: 書き出しが 6 文字に満たない短文の連続は数えない", () => {
    // 誤検知しやすい正常な文章。「はい。」の連続を反復と呼ばない。
    assert.ok(!idsFor("はい。はい。はい。はい。はい。").includes("repeated-sentence-head"));
  });
});

describe("sentence-rhythm", () => {
  it("既定では動かない（experimental）", () => {
    assert.ok(!idsFor(sentences(12, 40)).includes("sentence-rhythm"));
  });
  it("invalid: --experimental で、長さが揃った文章を指摘する", () => {
    assert.ok(idsFor(sentences(12, 40), true).includes("sentence-rhythm"));
  });
  it("valid: 長さがばらけていれば指摘しない", () => {
    const mixed =
      "短い。" +
      "あ".repeat(80) +
      "。" +
      "とても短い文。" +
      "い".repeat(120) +
      "。" +
      "短。" +
      "う".repeat(60) +
      "。" +
      "ここは中くらいの長さの文です。" +
      "え".repeat(150) +
      "。短。" +
      "お".repeat(40) +
      "。" +
      "終わり。";
    assert.ok(!idsFor(mixed, true).includes("sentence-rhythm"));
  });
  it("valid: 文が少ない文書では動かない", () => {
    // 誤検知しやすい正常な文章。3 文の文書の変動係数に意味はない。
    assert.ok(!idsFor(sentences(3, 40), true).includes("sentence-rhythm"));
  });
});

describe("rule 定義", () => {
  it("必須フィールドが揃っている", () => {
    RULES.forEach((rule) => {
      assert.ok(rule.name["ja"], `${rule.id}: name.ja`);
      assert.ok(rule.why["ja"], `${rule.id}: why.ja`);
      assert.ok(rule.how_to_fix["ja"], `${rule.id}: how_to_fix.ja`);
      assert.ok(rule.message["ja"], `${rule.id}: message.ja`);
      assert.ok(rule.levels.normal !== undefined, `${rule.id}: levels.normal`);
    });
  });

  it("英語では語数の閾値になる", () => {
    const en = loadRules("en").find((rule) => rule.id === "max-sentence-length");
    assert.equal(en?.levels.normal, 25);
    assert.equal(RULES.find((rule) => rule.id === "max-sentence-length")?.levels.normal, 100);
  });
});
