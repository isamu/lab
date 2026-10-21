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

  [
    ["上付きの中のリンクの ※1", 'シルバーリーダー<sup><a href="#fn1">※1</a></sup>等を', "シルバーリーダー※1等を"],
    ["同じページへのリンクの中の上付きの 注2", '基準<a href="#n2"><sup>注2</sup></a>による', "基準注2による"],
    ["空白のある †", 'rose.<sup><a href="#d"> † </a></sup> Next', "rose.† Next"],
    ["文字参照で書いた †1", 'rose.<sup><a href="#d">&dagger;1</a></sup> Next', "rose.&dagger;1 Next"],
  ].forEach(([form, html, kept]) => {
    it(`valid: 印の字で書いた脚注番号は字として残す（${String(form)}）`, () => assert.equal(withoutFootnoteMarks(String(html)), kept));
  });

  [
    ["全角の数字", 'rose.<sup><a href="#fn1">１</a></sup> Next'],
    ["括弧の数字", 'rose.<sup><a href="#fn1">（1）</a></sup> Next'],
    ["角括弧の数字", 'rose.<a href="#fn1"><sup>[2]</sup></a> Next'],
    ["文字参照で書いた数字", 'rose.<sup><a href="#fn1">&#49;</a></sup> Next'],
  ].forEach(([form, html]) => {
    it(`valid: 数字と括弧だけの脚注番号は落とす（${String(form)}）`, () => assert.equal(withoutFootnoteMarks(String(html)), "rose. Next"));
  });

  it("異常な入力: 空文字、閉じていない要素", () => {
    assert.equal(withoutFootnoteMarks(""), "");
    assert.equal(withoutFootnoteMarks('rose.<a href="#fn1"><sup>1'), 'rose.<a href="#fn1"><sup>1');
  });
});

// 「令和6年版高齢社会白書」（内閣府）第2章第2節4（https://www8.cao.go.jp/kourei/whitepaper/w-2024/html/zenbun/s2_2_4.html）を加工して作成（PDL-1.0）。
const CAO =
  '<p>交通安全教育を推進したほか、シルバーリーダー<sup><a href="#fn1">※1</a></sup>等を対象とした講習会を実施した。</p>' +
  '<div class="footnote" id="fn1">※1　シルバーリーダー<br>高齢者交通安全指導員</div>';

describe("htmlToMarkdown と脚注番号", () => {
  it("※ の付いた脚注番号は本文に残り、下の注を指す", () => {
    assert.equal(
      htmlToMarkdown(CAO),
      "交通安全教育を推進したほか、シルバーリーダー※1等を対象とした講習会を実施した。\n\n※1　シルバーリーダー\n高齢者交通安全指導員\n",
    );
  });

  it("文末の脚注番号は落ち、文と文がつながらない", () => {
    assert.equal(
      htmlToMarkdown(FED),
      "But the unemployment rate had increased, a development that historically has not occurred outside of recessions. Over the subsequent three meetings, we recalibrated our policy stance.\n\n1. For example, after the July 2024 employment report. Return to text\n",
    );
  });
});
