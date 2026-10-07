import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withRunInHeadingsRead } from "../packages/chaff/src/html/html-run-in-headings.ts";
import { htmlToMarkdown } from "../packages/chaff/src/html/html-markdown.ts";

// 連邦準備制度理事会の講演（2025 年 8 月 22 日、パブリックドメイン）を縮めたもの。節の題は <p><strong>題</strong><br /> 本文</p>。
const FED =
  "<main><h3>Monetary Policy and the Fed’s Framework Review</h3><p>Over the course of this year, the economy has shown resilience.</p>" +
  "<p><strong>Current Economic Conditions and Near-Term Outlook</strong><br />\nWhen I appeared at this podium one year ago, the economy was at an inflection point.</p>" +
  "<p>This year, the economy has faced new challenges.</p>" +
  "<p><strong>Conclusion</strong><br />\nIn closing, I want to thank President Schmid.</p></main>";

describe("withRunInHeadingsRead", () => {
  [
    ["直前の見出しの一つ下", "<h2>Report</h2><p><strong>Scope</strong><br>The text.</p>", "<h2>Report</h2><h3>Scope</h3><p>The text.</p>"],
    ["改行の後ろが箇条書きの前置き", "<h2>R</h2><p><strong>Scope</strong><br>It covers the same:</p>", "<h2>R</h2><h3>Scope</h3><p>It covers the same:</p>"],
    ["見出しが前に無ければ h2", "<p><b>Scope</b><br/>The text.</p>", "<h2>Scope</h2><p>The text.</p>"],
    ["h6 の下も h6", "<h6>Deep</h6><p><strong>Scope</strong> <br> The text.</p>", "<h6>Deep</h6><h6>Scope</h6><p> The text.</p>"],
    [
      "属性と空白",
      '<h1>T</h1><p class="x">\n <strong class="y">Scope</strong>\n<br class="z" />\nThe text.</p>',
      '<h1>T</h1><h2>Scope</h2><p class="x">\nThe text.</p>',
    ],
  ].forEach(([form, html, read]) => {
    it(`valid: ${String(form)}`, () => assert.equal(withRunInHeadingsRead(String(html)), read));
  });

  [
    ["太字の後ろに改行が無い（文の頭の強調）", "<p><strong>Note</strong> the text.</p>"],
    ["太字で文が終わる", "<p><strong>Read this first.</strong><br>The text.</p>"],
    ["太字がコロンで終わる（ラベル）", "<p><strong>Note:</strong><br>The text.</p>"],
    ["太字の前に文字", "<p>See <strong>Scope</strong><br>The text.</p>"],
    ["太字だけの段落", "<p><strong>Scope</strong><br></p>"],
    ["太字の中にタグ", '<p><strong><a href="/x">Scope</a></strong><br>The text.</p>'],
    ["空の太字", "<p><strong> </strong><br>The text.</p>"],
    ["改行の後ろに文が無い（署名の名前と役職）", "<p><strong>Jane Roe</strong><br>Secretary</p>"],
  ].forEach(([form, html]) => {
    it(`invalid: ${String(form)}`, () => assert.equal(withRunInHeadingsRead(String(html)), String(html)));
  });

  it("長すぎる太字は題ではない", () => {
    const long = `<p><strong>${"word ".repeat(40).trim()}</strong><br>The text.</p>`;
    assert.equal(withRunInHeadingsRead(long), long);
  });

  it("異常な入力: 空文字、閉じていない段落", () => {
    assert.equal(withRunInHeadingsRead(""), "");
    assert.equal(withRunInHeadingsRead("<p><strong>Scope</strong><br>The text."), "<p><strong>Scope</strong><br>The text.");
    assert.equal(withRunInHeadingsRead("<p><strong>Scope</strong><br>The text.<p>Next.</p>"), "<p><strong>Scope</strong><br>The text.<p>Next.</p>");
  });
});

describe("htmlToMarkdown と段落の頭の題", () => {
  it("段落の頭の太字の一行は、直前の見出しの一つ下の見出しになる", () => {
    assert.equal(
      htmlToMarkdown(FED),
      [
        "### Monetary Policy and the Fed’s Framework Review",
        "",
        "Over the course of this year, the economy has shown resilience.",
        "",
        "#### Current Economic Conditions and Near-Term Outlook",
        "",
        "When I appeared at this podium one year ago, the economy was at an inflection point.",
        "",
        "This year, the economy has faced new challenges.",
        "",
        "#### Conclusion",
        "",
        "In closing, I want to thank President Schmid.",
        "",
      ].join("\n"),
    );
  });
});
