import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loneConnectivesIn } from "../packages/chaff/src/detectors/connective-hierarchy.ts";

// 内の段の無い「並びに」「若しくは」（connective-hierarchy）。例文はすべて自作。

const RULE = "connective-hierarchy";
const LISTS = { connectives: ja.lexicons[RULE] ?? [], lookalikes: ja.lexicons["connective-lookalike"] ?? [] };

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, ja).findings;
const firesIn = (source: string, genre: string): boolean => firedRules(ja, `${source}\n`, genre).includes(RULE);

/** The lone connectives of every sentence of a one-paragraph source, as written. */
const loneIn = (source: string): readonly string[] =>
  buildDocument("a.md", `${source}\n`, ja).sentences.flatMap((sentence) => loneConnectivesIn(sentence, LISTS).map((lone) => lone.written));

describe("connective-hierarchy: 内の段の無い「並びに」「若しくは」", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("「及び」の無い文の「並びに」と、「又は」の無い文の「若しくは」を指す", () => {
    assert.deepEqual(findingsOf("申請書並びに添付書類を提出する。"), ["「並びに」の文に、段の組になる語がありません（一段なら「及び」）"]);
    assert.deepEqual(loneIn("書面若しくは電磁的方法により通知する。"), ["若しくは"]);
    assert.deepEqual(loneIn("理事並びに監事を置く。会員若しくは職員が出席する。"), ["並びに", "若しくは"]);
    assert.deepEqual(loneIn("会社は、申請書並びに添付書類を提出しなければならない。"), ["並びに"]);
    assert.deepEqual(loneIn("事業者、並びに団体は、必要な措置を講ずる。"), ["並びに"]);
  });

  it("二段に重ねた並べ方は指さない", () => {
    assert.deepEqual(loneIn("理事及び監事並びに職員を置く。"), []);
    assert.deepEqual(loneIn("書面若しくは電子メール又は口頭で通知する。"), []);
    assert.deepEqual(loneIn("理事および監事並びに職員を置く。"), []);
    assert.deepEqual(loneIn("書面若しくは電子メールまたは口頭で通知する。"), []);
  });

  it("一段の「及び」「又は」、仮名の「ならびに」「もしくは」、「並び」＋「に」は指さない", () => {
    assert.deepEqual(loneIn("申請書及び添付書類を提出する。書面又は口頭で通知する。"), []);
    assert.deepEqual(loneIn("申請書ならびに添付書類を提出する。書面もしくは口頭で通知する。"), []);
    assert.deepEqual(loneIn("列の並びに沿って座る。この並びに意味がある。正しい並びに直す。"), []);
    assert.deepEqual(loneIn("歯並びに悩む。各社が横並びになる。数字が縦並びに表示される。一列並びに座る。"), []);
    assert.deepEqual(loneIn(""), []);
  });

  it("「」『』の中は引いた語句の片方なので読まない", () => {
    assert.deepEqual(loneIn("「機関若しくは団体」とは、大学などをいう。"), []);
    assert.deepEqual(loneIn("同項中「定める事項」とあるのは、『定める事項並びに記録』とする。"), []);
  });

  it("話し言葉と文学では動かない", () => {
    const source = "申請書並びに添付書類を提出する。";
    assert.equal(firesIn(source, "legal/contract"), true);
    assert.equal(firesIn(source, "speech/transcript"), false);
    assert.equal(firesIn(source, "literature/fiction"), false);
  });

  it("位置は語の所", () => {
    const source = "申請書並びに添付書類を提出する。";
    const [sentence] = buildDocument("a.md", `${source}\n`, ja).sentences;
    assert.ok(sentence !== undefined);
    assert.deepEqual(
      loneConnectivesIn(sentence, LISTS).map((lone) => lone.offset),
      [source.indexOf("並びに")],
    );
  });
});
