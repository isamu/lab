import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { proseWithTables } from "../packages/chaff/src/table-text.ts";

// 表の行を本文に戻す（proseWithTables）。例文はすべて自作。

const masked = (source: string, from: number, to: number): string =>
  `${source.slice(0, from)}${source.slice(from, to).replace(/[^\r\n]/gu, " ")}${source.slice(to)}`;

describe("proseWithTables: 覆った表の行を原文のとおりに戻す", () => {
  it("見出しの行と本体の行を戻し、区切りの行と表の外はそのまま", () => {
    const source = "総額\n\n| 品目 | 金額 |\n| --- | --- |\n| 設計 | 300円 |\n\n後";
    const start = source.indexOf("|");
    const end = source.indexOf("\n\n後");
    const restored = proseWithTables(masked(source, start, end), source);
    assert.equal(restored.length, source.length);
    assert.equal(restored, `総額\n\n| 品目 | 金額 |\n${" ".repeat("| --- | --- |".length)}\n| 設計 | 300円 |\n\n後`);
  });

  it("コードを含む行は覆ったまま", () => {
    const source = "| a | b |\n| --- | --- |\n| x | `1円` |\n";
    const prose = masked(source, 0, source.length - 1);
    assert.equal(proseWithTables(prose, source).split("\n")[2]?.trim(), "");
    assert.equal(proseWithTables(prose, source).split("\n")[0], "| a | b |");
  });

  it("覆っていない行（本文で表の形をしたもの）は本文のまま", () => {
    const source = "| a | b |\n| --- | --- |\n";
    const prose = "| x | y |\n| --- | --- |\n";
    assert.equal(proseWithTables(prose, source), prose);
  });

  it("表の無い文書と、空の入力", () => {
    assert.equal(proseWithTables("本文です。\n", "本文です。\n"), "本文です。\n");
    assert.equal(proseWithTables("", ""), "");
    assert.equal(proseWithTables("   \n", "| a |\n"), "   \n");
  });

  it("\\r\\n の文書でも位置を保つ", () => {
    const source = "| a | b |\r\n| --- | --- |\r\n| x | 5円 |\r\n";
    const prose = source.replace(/[^\r\n]/gu, " ");
    const restored = proseWithTables(prose, source);
    assert.equal(restored.length, source.length);
    assert.ok(restored.includes("| x | 5円 |\r\n"));
  });
});
