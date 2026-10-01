import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { closingSentences } from "../packages/chaff/src/closing-paragraph.ts";
import type { Paragraph, Sentence } from "../packages/chaff/src/plugin.ts";

const sentence = (start: number, text: string): Sentence => ({ span: { start, end: start + text.length }, text });

const paragraph = (start: number, end: number, text: string): Paragraph => ({ span: { start, end }, sentences: [sentence(start, text)] });

const section = (start: number, end: number): { span: { start: number; end: number } } => ({ span: { start, end } });

const textsOf = (sentences: readonly Sentence[]): string[] => sentences.map((entry) => entry.text);

describe("closingSentences: 最後の節の、最後の段落", () => {
  const paragraphs = [paragraph(0, 10, "冒頭"), paragraph(20, 30, "中ほど"), paragraph(40, 50, "結び")];

  it("節が一つ（見出しが無い）なら、文書の最後の段落", () => {
    assert.deepEqual(textsOf(closingSentences([section(0, 50)], paragraphs)), ["結び"]);
  });

  it("節がいくつあっても、最後の節の最後の段落だけ", () => {
    assert.deepEqual(textsOf(closingSentences([section(0, 15), section(15, 50)], paragraphs)), ["結び"]);
  });

  it("最後の節の外の段落は結びにしない（最後の節に段落が無い）", () => {
    assert.deepEqual(textsOf(closingSentences([section(0, 35), section(35, 39)], paragraphs)), []);
    assert.deepEqual(textsOf(closingSentences([section(0, 20), section(20, 40)], paragraphs)), ["中ほど"]);
  });

  it("最後の節の始まりの段落も、終わりの手前に始まる段落も節の中", () => {
    assert.deepEqual(textsOf(closingSentences([section(0, 20), section(20, 30)], paragraphs)), ["中ほど"]);
    assert.deepEqual(textsOf(closingSentences([section(0, 20), section(20, 41)], paragraphs)), ["結び"]);
  });

  it("節も段落も無ければ空", () => {
    assert.deepEqual(closingSentences([], paragraphs), []);
    assert.deepEqual(closingSentences([section(0, 50)], []), []);
  });
});
