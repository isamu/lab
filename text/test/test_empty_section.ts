import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { emptySections } from "../packages/chaff/src/detectors/empty-section.ts";
import type { MarkupHeading } from "../packages/chaff/src/plugin.ts";

// 中身の無い節（empty-section）。例文はすべて自作。

const RULE = "empty-section";

const findingsOf = (source: string, adapter = ja, path = "a.md"): readonly string[] => namedRuleRun(RULE, source, adapter, path).findings;

/** 見出しの行（# の数で深さ）と本文の行を並べた文書と、その見出し。 */
const documentOf = (lines: readonly string[]): { readonly source: string; readonly headings: MarkupHeading[] } => {
  const source = lines.join("\n");
  const headings = lines.flatMap((line, index) => {
    const marks = /^(#+) /u.exec(line)?.[1];
    const start = lines.slice(0, index).join("\n").length + (index === 0 ? 0 : 1);
    return marks === undefined ? [] : [{ depth: marks.length, text: line.slice(marks.length + 1), start, end: start + line.length }];
  });
  return { source, headings };
};

const emptyIn = (lines: readonly string[]): string[] => {
  const { source, headings } = documentOf(lines);
  return emptySections(source, headings).map((heading) => heading.text);
};

describe("empty-section: 中身の無い節", () => {
  it("すぐ後ろに同じ深さの見出しが来る節", () => {
    assert.deepEqual(findingsOf("# 手順書\n\n## 準備\n\n## 作業\n\n部品を取り付けます。\n"), ["見出し「準備」の下に中身がありません"]);
  });

  it("英語の文書は英語で言う", () => {
    assert.deepEqual(findingsOf("# Guide\n\n## Before you start\n\n## Steps\n\nFit the parts.\n", en), ['Nothing under the heading "Before you start"']);
  });

  it("浅い見出しが続くのも空。文書の最後の見出しも、後ろに何も無ければ空", () => {
    assert.deepEqual(emptyIn(["# A", "", "## B", "", "text", "", "### C", "", "## D", "", "text", "", "## E", ""]), ["C", "E"]);
  });

  it("深い見出しが続くのは、節を小さな節に分けただけ", () => {
    assert.deepEqual(emptyIn(["# A", "", "## B", "", "text"]), []);
  });

  it("HTML のコメントだけの節は空。コメントの間に本文があれば中身がある", () => {
    assert.deepEqual(emptyIn(["## A", "<!-- 後で書く -->", "", "## B", "<!-- toc -->", "- [A](#a)", "<!-- /toc -->", "", "## C", "text"]), ["A"]);
  });

  it("コロンで終わる見出しは、後ろの見出しの前置き（署名欄の「Accepted and agreed to:」）", () => {
    assert.deepEqual(emptyIn(["## Accepted and agreed to:", "", "## Example Inc.", "", "By: signature", "", "## 確認欄：", "", "## 担当", "", "山田"]), []);
  });

  it("二行にわたる下線の見出し（メールの区切り線の上の段落）は見出しとして読まない", () => {
    assert.deepEqual(findingsOf("# お知らせ\n\n※ 本メールは送信専用です。\nご了承ください。\n----------\n"), []);
  });

  it("中身があれば何も言わない", () => {
    assert.deepEqual(findingsOf("# 手順書\n\n## 準備\n\n道具をそろえます。\n\n## 作業\n\n部品を取り付けます。\n"), []);
    assert.deepEqual(emptyIn([]), []);
  });

  it("Markdown でない文書では動かず、理由を言う", () => {
    assert.deepEqual(namedRuleRun(RULE, "準備\n", ja, "a.txt").skipped, ["Markdown の文書ではないため"]);
  });
});
