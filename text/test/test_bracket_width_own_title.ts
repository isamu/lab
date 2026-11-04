import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { ownTitleQuoteSpans } from "../packages/chaff/src/own-title-quote.ts";

// bracket-width-consistency: an article that cites itself repeats its own heading, brackets and all. Every example is self-written.

before(async () => {
  await ja.prepare?.({ pos: true });
});

const RULE = "bracket-width-consistency";
const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, ja, "a.md", "academic/paper").findings;

const BODY = ["本稿（概要）を述べる。", "調査（第一次）を行った。", "結果（速報）を示す。", "課題（今後）を挙げる。", "対応（案）を示す。"];

describe("bracket-width-consistency on a quotation of the document's own heading", () => {
  it("does not count the brackets of the document's heading quoted in its citation", () => {
    const source = ["# 共有データ管理計画(DMP)の動向", "", ...BODY, "", "山田太郎. 共有データ管理計画(DMP)の動向. 図書館研究. 2020.", ""].join("\n");
    assert.deepEqual(findingsOf(source), []);
  });

  it("still counts the same brackets in a sentence that does not repeat the heading", () => {
    const source = ["# 共有データ管理計画(DMP)の動向", "", ...BODY, "", "管理計画(DMP)を作る。", ""].join("\n");
    assert.equal(findingsOf(source).length, 2);
  });

  it("still counts a table of contents' line that is only the heading", () => {
    const source = ["- 共有データ管理計画(DMP)の動向", "", ...BODY, "", "# 共有データ管理計画(DMP)の動向", ""].join("\n");
    assert.equal(findingsOf(source).length, 2);
  });

  it("finds the quotations outside the heading only, and not of a short heading", () => {
    const headings = [{ depth: 1, text: "計画(DMP)の動向", start: 2, end: 12 }];
    assert.deepEqual(ownTitleQuoteSpans("# 計画(DMP)の動向\n計画(DMP)の動向.", headings, new Set(["(", ")"])), [{ start: 13, end: 23 }]);
    assert.deepEqual(ownTitleQuoteSpans("# (注)\n(注)", [{ depth: 1, text: "(注)", start: 2, end: 5 }], new Set(["(", ")"])), []);
  });
});
