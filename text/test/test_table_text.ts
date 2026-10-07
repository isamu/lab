import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { proseAndTablesOf, proseWithTables } from "../packages/chaff/src/table-text.ts";

// 表を本文に戻す（proseWithTables、proseAndTablesOf）。例文はすべて自作。

const blank = (text: string): string => text.replace(/[^\n]/gu, " ");

describe("proseWithTables: 覆った表を原文のとおりに戻す", () => {
  it("表の範囲だけを戻し、表の外と位置はそのまま", () => {
    const source = "総額\n\n| 品目 | 金額 |\n| --- | --- |\n| 設計 | 300円 |\n\n後";
    const table = { start: source.indexOf("|"), end: source.indexOf("\n\n後") };
    const prose = `${source.slice(0, table.start)}${blank(source.slice(table.start, table.end))}${source.slice(table.end)}`;
    assert.equal(proseWithTables(prose, source, [table], []), source);
  });

  it("表の中で隠す範囲（升のコード）は覆ったまま", () => {
    const source = "| a | b |\n| --- | --- |\n| `x` | 1円 |\n";
    const code = { start: source.indexOf("`"), end: source.lastIndexOf("`") + 1 };
    const restored = proseWithTables(blank(source), source, [{ start: 0, end: source.length }], [code]);
    assert.equal(restored.length, source.length);
    assert.ok(restored.includes("|     | 1円 |"));
  });

  it("表の無い入力と、空の入力", () => {
    assert.equal(proseWithTables("本文です。\n", "本文です。\n", [], []), "本文です。\n");
    assert.equal(proseWithTables("", "", [], []), "");
  });

  it("重なる範囲は一度だけ戻す", () => {
    const source = "| a |\n| --- |\n| 1円 |\n";
    const all = { start: 0, end: source.length };
    assert.equal(proseWithTables(blank(source), source, [all, { start: 2, end: 5 }], []), source);
  });
});

describe("proseAndTablesOf: 文書の本文と表", () => {
  const textOf = (source: string, path = "t.md"): string => proseAndTablesOf(buildDocument(path, source, ja));

  it("表を読み、コードの塊の中の表の形は読まない", () => {
    assert.ok(textOf("# 見積\n\n| 品目 | 金額 |\n| --- | --- |\n| 設計 | 30万円 |\n").includes("30万円"));
    assert.ok(!textOf("# 例\n\n```\n| 品目 | 金額 |\n| --- | --- |\n| 設計 | 30万円 |\n```\n").includes("30万円"));
  });

  it("升のコードは読まず、同じ行のほかの升は読む", () => {
    const text = textOf("# 見積\n\n| 品目 | 金額 |\n| --- | --- |\n| `設計` | 30万円 |\n");
    assert.ok(text.includes("30万円"));
    assert.ok(!text.includes("`設計`"));
  });

  it("引用の中の表は読まない", () => {
    assert.ok(!textOf("# 返信\n\n> | 品目 | 金額 |\n> | --- | --- |\n> | 設計 | 30万円 |\n").includes("30万円"));
  });

  it("表の無い文書は本文のまま", () => {
    const doc = buildDocument("t.md", "# 見積\n\n総額は30万円です。\n", ja);
    assert.equal(proseAndTablesOf(doc), doc.prose);
  });
});
