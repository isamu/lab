import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { genericOpening } from "../packages/chaff/src/semantic.ts";
import { openingProse, opensWithNumber, OPENING_PROSE_SENTENCES } from "../packages/chaff/src/opening-passage.ts";
import { planSemantic } from "../packages/chaff/src/run-semantic.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { runCli } from "./cli-run.ts";

const jaDoc = (source: string) => buildDocument("t.md", source, ja);
const enDoc = (source: string) => buildDocument("t.md", source, en);

describe("opening-passage", () => {
  it("句点で閉じた最初の文から、箇条書きを除いて数える", () => {
    const doc = jaDoc("# 題\n\n2026年4月24日\n\n- 項目\n\n一文目です。二文目です。\n\n三文目です。四文目です。\n");
    assert.deepEqual(
      openingProse(doc).map((sentence) => sentence.text.trim()),
      ["一文目です。", "二文目です。", "三文目です。"],
    );
    assert.equal(openingProse(doc).length, OPENING_PROSE_SENTENCES);
  });

  it("日付・署名・読了時間の行は書き出しにしない", () => {
    const doc = enDoc("6 min read\n\nNASA STEM Team\n\nMay 07, 2025\n\nMany teams struggle with reviews.\n");
    assert.equal(openingProse(doc)[0]?.text.trim(), "Many teams struggle with reviews.");
  });

  it("次の節の文は書き出しに入れない", () => {
    const doc = enDoc("Concrete intro.\n\n## Details\n\nMany teams struggle with reviews.\n");
    assert.deepEqual(
      openingProse(doc).map((sentence) => sentence.text.trim()),
      ["Concrete intro."],
    );
  });

  it("省略記号で終わる文も書き出しにする", () => {
    assert.equal(openingProse(jaDoc("多くの企業が悩んでいる…\n\n当社の話です。\n"))[0]?.text.trim(), "多くの企業が悩んでいる…");
  });

  it("文が無ければ空", () => {
    assert.deepEqual(openingProse(jaDoc("")), []);
    assert.deepEqual(openingProse(jaDoc("# 題だけ\n")), []);
    assert.equal(opensWithNumber([]), false);
  });
});

describe("絞り込み: generic-opening", () => {
  it("一般論の書き出しは送る（日本語）", () => {
    const found = genericOpening(jaDoc("多くの企業が、問い合わせ対応に課題を抱えています。本記事では解決策を紹介します。\n"));
    assert.equal(found.length, 1);
    assert.match(found[0]?.text ?? "", /^多くの企業が/u);
  });

  it("一般論の書き出しは送る（英語）", () => {
    const found = genericOpening(enDoc("In today's fast-paced world, every team needs a plan. This post shows ours.\n"));
    assert.equal(found.length, 1);
    assert.match(found[0]?.text ?? "", /This post shows ours\.$/u);
  });

  it("最初の文が数を言うなら送らない", () => {
    // 誤検知しやすい正常な文章。日付や件数から始まる書き出しは、もう具体から始まっている。
    assert.deepEqual(genericOpening(jaDoc("10月の売上は 1,240 万円で、目標に対して 103% でした。\n")), []);
    assert.deepEqual(genericOpening(enDoc("Customer support handled 4,820 tickets in Q3. That is up from Q2.\n")), []);
  });

  it("具体の書き出しでも数が無ければ送る。決めるのは AI", () => {
    assert.equal(genericOpening(enDoc("I bought a standing desk because my back gave out.\n")).length, 1);
  });

  it("本文が無ければ送らない", () => {
    assert.deepEqual(genericOpening(jaDoc("")), []);
    assert.deepEqual(genericOpening(enDoc("- only a list\n- of items\n")), []);
  });
});

describe("generic-opening の段", () => {
  const jobsFor = (genre: string): string[] => planSemantic(jaDoc("多くの企業が課題を抱えています。\n"), loadRules("ja"), [], {}, genre).map((job) => job.rule);

  it("ブログと報告・提案では問い合わせる", () => {
    ["blog/tech", "blog/essay", "business/report", "business/proposal"].forEach((genre) => assert.ok(jobsFor(genre).includes("generic-opening"), genre));
  });

  it("メール・議事録・プレスリリース・技術文書では問い合わせない", () => {
    ["business/email", "business/meeting-notes", "business/press-release", "technical", "legal"].forEach((genre) =>
      assert.ok(!jobsFor(genre).includes("generic-opening"), genre),
    );
  });

  it("off にすれば問い合わせない", () => {
    const jobs = planSemantic(jaDoc("多くの企業が課題を抱えています。\n"), loadRules("ja"), [], { "generic-opening": "off" }, "blog/tech");
    assert.ok(!jobs.some((job) => job.rule === "generic-opening"));
  });
});

// 機械の検査と、ほかの意味を読む検査を止める。dry-run は最初の検査の送る文章だけを出す。
const ONLY_THIS = ["rules:", ...loadRules("ja").flatMap((rule) => (rule.id === "generic-opening" ? [] : [`  ${rule.id}: off`]))].join("\n");

describe("chaff test --dry-run: generic-opening", () => {
  it("書き出しを送り、送る文章を出す", async () => {
    const source = "# 問い合わせの話\n\n多くの企業が、問い合わせ対応に課題を抱えています。本記事では解決策を紹介します。\n\n## 手順\n\n設定を開きます。\n";
    const run = await runCli({ "chaff.yaml": `${ONLY_THIS}\n`, "a.md": source }, ["test", "a.md", "--dry-run", "--genre", "blog/tech"]);
    assert.match(run.out, /1 箇所 {2}一般論で始まる書き出し/u);
    assert.match(run.out, /多くの企業が、問い合わせ対応に課題を抱えています。/u);
  });
});
