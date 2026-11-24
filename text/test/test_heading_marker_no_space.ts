import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// heading-marker-no-space: a line meant as a heading with no space after its marks (#見出し, ##Steps). Every example is self-written.

const RULE = "heading-marker-no-space";

const count = (source: string, adapter: LanguageAdapter, genre = "blog/tech"): number =>
  firedRules(adapter, source, genre).filter((rule) => rule === RULE).length;

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("heading-marker-no-space: reports marks with no space after them", () => {
  it("reports ##見出し among spaced headings", () => {
    const source = "# 引っ越し\n\n##一か月前\n\n転出届を出します。\n\n## 一週間前\n\n荷物を詰めます。\n";
    assert.equal(count(source, ja), 1);
  });

  it("reports ##Heading in a document with no spaced heading at all", () => {
    const source = "##Overview\n\nThe plan.\n\n##Costs\n\nIt costs less.\n";
    assert.equal(count(source, en), 2);
  });

  it("reports a one-mark title when the document writes headings elsewhere", () => {
    const source = "#Moving house\n\n## A month before\n\nTell the council.\n";
    assert.equal(count(source, en), 1);
  });

  it("reports a Japanese one-mark line when the document writes headings elsewhere", () => {
    const source = "#引っ越しの手順\n\n##一か月前\n\n転出届を出します。\n";
    assert.equal(count(source, ja), 2);
  });

  it("reports a closed heading with no space (#Heading#)", () => {
    const source = "# Guide\n\n##Steps##\n\nDo this.\n";
    assert.equal(count(source, en), 1);
  });

  it("reports a marked line inside a paragraph, where a spaced one would have started a heading", () => {
    const source = "# Guide\n\nThe first part.\n##Steps\n\nDo this.\n";
    assert.equal(count(source, en), 1);
  });
});

describe("heading-marker-no-space: does not report", () => {
  it("a spaced heading", () => {
    assert.equal(count("# Guide\n\n## Steps\n\nDo this.\n", en), 0);
  });

  it("a number after the mark: an issue, a short dial number", () => {
    const source = "# 相談窓口\n\n## 電話\n\n警察の相談専用電話\n#9110\n\n#123 で直しました。\n";
    assert.equal(count(source, ja), 0);
  });

  it("a one-mark tag, a row of tags, or a lower-case word", () => {
    const source = "# Notes\n\n## Today\n\nWe shipped it.\n\n#chaff\n\n#Release #Notes\n\n#include <stdio.h>\n";
    assert.equal(count(source, en), 0);
  });

  it("a one-mark line in a document that writes no heading", () => {
    const source = "今日のまとめです。\n\n#振り返り\n\n楽しかった。\n";
    assert.equal(count(source, ja), 0);
  });

  it("a one-mark line that is not a paragraph on its own", () => {
    const source = "# Guide\n\n## Steps\n\nFollow us on\n#Mastodon for news.\n";
    assert.equal(count(source, en), 0);
  });

  it("marks in code, a list, a table or a quotation", () => {
    const source = "# Guide\n\n## Steps\n\n```\n##notheading\n```\n\n- ##item\n\n| ##cell |\n| --- |\n| a |\n\n> ##quoted\n\nDone.\n";
    assert.equal(count(source, en), 0);
  });
});
