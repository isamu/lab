import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { closingSentences } from "../packages/chaff/src/closing-paragraph.ts";
import type { Paragraph, Sentence } from "../packages/chaff/src/plugin.ts";

const sentence = (start: number, text: string): Sentence => ({ span: { start, end: start + text.length }, text });

const PARAGRAPH_STRIDE = 10;

/** texts の数だけ、PARAGRAPH_STRIDE 字おきに並んだ一文の段落。 */
const paragraphsOf = (...texts: readonly string[]): Paragraph[] =>
  texts.map((text, index) => {
    const start = index * PARAGRAPH_STRIDE;
    return { span: { start, end: start + text.length }, sentences: [sentence(start, text)] };
  });

const section = (start: number, end: number): { span: { start: number; end: number } } => ({ span: { start, end } });

const textsOf = (sentences: readonly Sentence[]): string[] => sentences.map((entry) => entry.text);

describe("closingSentences: 最後の節の終わりの段落で、書き出しの段落でないもの", () => {
  it("節が一つ（見出しが無い）なら、文書の終わりの段落。最初の段落は結びにしない", () => {
    assert.deepEqual(textsOf(closingSentences([section(0, 40)], paragraphsOf("冒頭", "二", "三", "結び"))), ["二", "三", "結び"]);
    assert.deepEqual(textsOf(closingSentences([section(0, 20)], paragraphsOf("冒頭", "結び"))), ["結び"]);
  });

  it("長い節では、終わりの四段落だけ", () => {
    const paragraphs = paragraphsOf("一", "二", "三", "四", "五", "六", "七", "八", "九", "十");
    assert.deepEqual(textsOf(closingSentences([section(0, 100)], paragraphs)), ["七", "八", "九", "十"]);
  });

  it("節がいくつあっても、最後の節の段落だけ", () => {
    const paragraphs = paragraphsOf("一", "二", "三", "四", "結び");
    assert.deepEqual(textsOf(closingSentences([section(0, 40), section(40, 50)], paragraphs)), ["結び"]);
  });

  it("最後の節の始まりの段落は節の中、終わりの位置に始まる段落は外", () => {
    const paragraphs = paragraphsOf("一", "二", "三", "四", "五");
    assert.deepEqual(textsOf(closingSentences([section(0, 30), section(30, 40)], paragraphs)), ["四"]);
    assert.deepEqual(textsOf(closingSentences([section(0, 30), section(30, 41)], paragraphs)), ["四", "五"]);
  });

  it("段落が一つなら、それが結び", () => {
    assert.deepEqual(textsOf(closingSentences([section(0, 10)], paragraphsOf("結び"))), ["結び"]);
  });

  it("最後の節に段落が無い、節も段落も無ければ空", () => {
    assert.deepEqual(closingSentences([section(0, 25), section(25, 29)], paragraphsOf("一", "二", "三")), []);
    assert.deepEqual(closingSentences([], paragraphsOf("一")), []);
    assert.deepEqual(closingSentences([section(0, 50)], []), []);
  });
});
