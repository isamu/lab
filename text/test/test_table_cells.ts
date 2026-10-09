import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cellWithTokens, proseWithCells } from "../packages/chaff/src/table-cells.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import type { Segmentation } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 表の升の語（doc.tableCells）。例文はすべて自作。

const cell = (text: string, start: number): { start: number; end: number; text: string } => ({ start, end: start + text.length, text });

/** 空白で語に分ける segment。位置は渡した字の上。 */
const bySpaces = (text: string): Segmentation => ({
  sentences: [
    {
      span: { start: 0, end: text.length },
      text,
      tokens: [...text.matchAll(/\S+/gu)].map((match) => ({ surface: match[0], span: { start: match.index, end: match.index + match[0].length }, pos: "X" })),
    },
  ],
});

const untagged = (text: string): Segmentation => ({ sentences: [{ span: { start: 0, end: text.length }, text }] });

describe("cellWithTokens", () => {
  it("the cell's words, at their place in the source", () => {
    const tokens = cellWithTokens(cell(" Ann Lee ", 10), bySpaces).tokens ?? [];
    assert.deepEqual(
      tokens.map((token) => [token.surface, token.span.start, token.span.end]),
      [
        ["Ann", 11, 14],
        ["Lee", 15, 18],
      ],
    );
  });

  it("a cell without letters, or an adapter that does not tag, gives no words", () => {
    assert.equal(cellWithTokens(cell(" 3,000 ", 0), bySpaces).tokens, undefined);
    assert.equal(cellWithTokens(cell("", 0), bySpaces).tokens, undefined);
    assert.equal(cellWithTokens(cell(" Ann Lee ", 0), untagged).tokens, undefined);
  });
});

describe("proseWithCells", () => {
  it("writes the cells back into the prose at their place, and keeps the rest covered", () => {
    assert.equal(proseWithCells("ab        z", [cell(" Ann ", 3), cell("x", 9)]), "ab  Ann  xz");
    assert.equal(proseWithCells("abc", []), "abc");
  });

  it("a cell that overlaps the one before, or whose text does not fit its span, is left out", () => {
    assert.equal(proseWithCells("          ", [cell("abcd", 2), cell("x", 3)]), "  abcd    ");
    assert.equal(proseWithCells("          ", [{ start: 2, end: 3, text: "long" }]), "          ");
  });
});

const TABLE = "担当は佐々木 美穂です。\n\n| 担当 | 内容 |\n| --- | --- |\n| 佐々木 美保 | 手順を書く |\n| 12 | 30 |\n";

describe("doc.tableCells", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("each body cell of a Markdown table, with the tagger's readings", () => {
    const doc = buildDocument("a.md", TABLE, ja);
    const cells = doc.tableCells?.() ?? [];
    assert.deepEqual(
      cells.map((each) => each.text.trim()),
      ["佐々木 美保", "手順を書く", "12", "30"],
    );
    const [name] = cells;
    assert.deepEqual(
      (name?.tokens ?? []).filter((token) => token.pos === "PROPN").map((token) => [doc.source.slice(token.span.start, token.span.end), token.reading]),
      [
        ["佐々木", "ササキ"],
        ["美保", "ミホ"],
      ],
    );
    assert.equal(doc.tableCells?.(), cells);
  });

  it("the sentences do not change: the table stays outside the prose", () => {
    const withTable = buildDocument("a.md", TABLE, ja);
    const withoutTable = buildDocument("a.md", "担当は佐々木 美穂です。\n", ja);
    assert.deepEqual(
      withTable.sentences.map((sentence) => sentence.text),
      withoutTable.sentences.map((sentence) => sentence.text),
    );
  });

  it("a document without a table, a table in a quote and a text document have no cells", () => {
    assert.deepEqual(buildDocument("a.md", "Ann Lee wrote it.\n", en).tableCells?.(), []);
    assert.deepEqual(buildDocument("a.md", "> | A | B |\n> | --- | --- |\n> | Ann Lee | x |\n", en).tableCells?.(), []);
    assert.deepEqual(buildDocument("a.txt", "| A | B |\n| --- | --- |\n| Ann Lee | x |\n", en).tableCells?.(), []);
  });
});
