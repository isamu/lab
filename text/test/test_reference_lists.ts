import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { referenceListSpans } from "../packages/chaff/src/reference-lists.ts";

const HEADINGS = ["References", "参考文献"];
const cut = (source: string): string[] => referenceListSpans(source, HEADINGS).map((span) => source.slice(span.start, span.end));

describe("文献一覧の範囲", () => {
  it("見出しの語だけの段落と、すぐ後の箇条書き", () => {
    const source = "本文。\n\nReferences\n\n- [1] A. 2020.\n\n- [2] B. 2021.\n\nFigures & tables\n";
    assert.deepEqual(cut(source), ["References\n\n- [1] A. 2020.\n\n- [2] B. 2021."]);
  });

  it("番号の書きかた（1.、[1]、*）と、字下げした続きの行", () => {
    const source = "参考文献\n\n1. 山田．2020．\n   続きの行．\n[2] 鈴木．\n* 佐藤．\n\n以上。";
    assert.deepEqual(cut(source), ["参考文献\n\n1. 山田．2020．\n   続きの行．\n[2] 鈴木．\n* 佐藤．"]);
  });

  it("Markdown の見出しは、次の同じ深さか浅い見出しまで", () => {
    const source = "# 論文\n\n## 参考文献\n\n山田．2020．\n\n### 和文\n\n鈴木．\n\n## 付録\n\n本文。";
    assert.deepEqual(cut(source), ["## 参考文献\n\n山田．2020．\n\n### 和文\n\n鈴木．\n"]);
  });

  it("最後の節なら文書の終わりまで", () => {
    assert.deepEqual(cut("本文。\n\n## References\n\nA. 2020."), ["## References\n\nA. 2020."]);
  });

  it("節番号・強調・コロン・大文字小文字の違いは同じ見出し", () => {
    ["## 7. References", "**References**", "REFERENCES:", "参考文献：", "## References ##"].forEach((heading) => {
      assert.equal(cut(`本文。\n\n${heading}\n\n- A. 2020.\n`).length, 1, heading);
    });
  });

  it("見出しの語を含むだけの行は見出しでない", () => {
    ["References cited in this report", "See the references below.", "主な参考文献について"].forEach((line) => {
      assert.deepEqual(cut(`本文。\n\n${line}\n\n- A. 2020.\n`), [], line);
    });
  });

  it("段落の途中の行は、見出しの語だけでも見出しでない", () => {
    assert.deepEqual(cut("本文。\nReferences\n- A. 2020.\n"), []);
  });

  it("見出しの後が箇条書きでなければ何も返さない", () => {
    assert.deepEqual(cut("References\n\nThe list follows on the next page.\n\n- A. 2020.\n"), []);
  });

  it("見出しで終わる文書・空の文書でも投げない", () => {
    assert.deepEqual(cut("本文。\n\nReferences"), []);
    assert.deepEqual(cut(""), []);
    assert.deepEqual(referenceListSpans("References\n\n- A.\n", []), []);
  });

  it("範囲は元の文字列の位置", () => {
    const source = "本文。\n\nReferences\n\n- A. 2020.\n\n## References\n\nB.";
    referenceListSpans(source, HEADINGS).forEach((span) => assert.ok(span.start >= 0 && span.end <= source.length && span.start < span.end));
    assert.equal(cut(source).length, 2);
  });
});
