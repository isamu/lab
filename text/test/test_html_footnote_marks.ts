import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withoutFootnoteMarks } from "../packages/chaff/src/html/html-footnote-marks.ts";
import { htmlToMarkdown } from "../packages/chaff/src/html/html-markdown.ts";

// 連邦準備制度理事会の講演（2025 年 8 月 22 日、パブリックドメイン）を縮めたもの。脚注番号は <a href="#fn1"><sup>1</sup></a>。
const FED =
  '<main><p>But the unemployment rate had increased, a development that historically has not occurred outside of recessions.<a href="#fn1" title="footnote 1"><sup>1</sup></a><a name="f1"></a> Over the subsequent three meetings, we recalibrated our policy stance.</p>' +
  '<hr /><p><a name="fn1"></a>1. For example, after the July 2024 employment report. <a href="#f1">Return to text</a></p></main>';

describe("withoutFootnoteMarks", () => {
  [
    ["上付きの中のリンク", 'rose.<sup><a href="#fn1">1</a></sup> Next', "rose. Next"],
    ["上付きの中のほかのページへのリンク（注が別のページにある）", 'rose.<sup><a href="/notes.htm#n1">1</a></sup> Next', "rose. Next"],
    ["同じページへのリンクの中の上付き", 'rose.<a href="#fn1"><sup>1</sup></a> Next', "rose. Next"],
    ["属性と空白", `rose.<a class="fn" href='#note-12' title="footnote 12"> <sup class="x">12</sup> </a> Next`, "rose. Next"],
    ["記号の脚注", 'rose.<a href="#star"><sup>*</sup></a> Next', "rose. Next"],
    ["引用符の無い属性", "rose.<a href=#fn1><sup>1</sup></a> Next", "rose. Next"],
  ].forEach(([form, html, dropped]) => {
    it(`valid: ${String(form)}`, () => assert.equal(withoutFootnoteMarks(String(html)), dropped));
  });

  [
    ["ほかのページへのリンクの中の上付き", 'Brand<a href="/trademark.htm"><sup>TM</sup></a> Next'],
    ["# だけのリンク", 'rose.<a href="#"><sup>?</sup></a> Next'],
    ["引用符の無い # だけのリンク", "rose.<a href=#><sup>?</sup></a> Next"],
    ["上付きのほかにも文字があるリンク", 'see <a href="#fn1">note <sup>1</sup></a> below'],
    ["リンクの無い上付き", "The 25<sup>th</sup> year."],
    ["空の上付き", 'rose.<a href="#fn1"><sup></sup></a> Next'],
  ].forEach(([form, html]) => {
    it(`invalid: ${String(form)}`, () => assert.equal(withoutFootnoteMarks(String(html)), String(html)));
  });

  it("異常な入力: 空文字、閉じていない要素", () => {
    assert.equal(withoutFootnoteMarks(""), "");
    assert.equal(withoutFootnoteMarks('rose.<a href="#fn1"><sup>1'), 'rose.<a href="#fn1"><sup>1');
  });
});

describe("htmlToMarkdown と脚注番号", () => {
  it("文末の脚注番号は落ち、文と文がつながらない", () => {
    assert.equal(
      htmlToMarkdown(FED),
      "But the unemployment rate had increased, a development that historically has not occurred outside of recessions. Over the subsequent three meetings, we recalibrated our policy stance.\n\n1. For example, after the July 2024 employment report. Return to text\n",
    );
  });
});
