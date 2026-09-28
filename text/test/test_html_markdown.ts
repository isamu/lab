import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { htmlToMarkdown } from "../scripts/html-markdown.ts";
import { decodeEntities } from "../scripts/markup-text.ts";

// HTML の報告書を Markdown に。見出し・段落・箇条書き・リンクの文字だけを残す。例文はすべて自作。

describe("htmlToMarkdown: 見出し・段落・箇条書き", () => {
  it("h1〜h6 は # の数、p と div は段落、改行の空白はまとめる", () => {
    const html = "<h1>Annual Report</h1><div><h2>Summary</h2><p>Costs rose\n   in the second\tyear.</p><p>Staff fell.</p></div>";
    assert.equal(htmlToMarkdown(html), "# Annual Report\n\n## Summary\n\nCosts rose in the second year.\n\nStaff fell.\n");
  });

  it("li は - の行、br は改行", () => {
    assert.equal(
      htmlToMarkdown("<p>Two steps:</p><ul><li>Plan <em>early</em></li><li>Review</li></ul><p>Updated May 1<br>2024</p>"),
      "Two steps:\n\n- Plan early\n- Review\n\nUpdated May 1\n2024\n",
    );
  });

  it("リンクは文字だけ、中身の無い項目は残さない", () => {
    assert.equal(htmlToMarkdown('<p>See <a href="https://example.com/r">the report</a>.</p><ul><li></li></ul>'), "See the report.\n");
  });

  it("空の入力は空", () => {
    assert.equal(htmlToMarkdown(""), "");
    assert.equal(htmlToMarkdown("<html><head><title>T</title></head><body></body></html>"), "");
  });
});

describe("htmlToMarkdown: 落とすもの", () => {
  it("script・style・head・nav・表・コメントを、入れ子の表も含めて落とす", () => {
    const html =
      "<html><head><title>Site</title><style>p{}</style></head><body><nav><a href='/'>Home</a></nav><script>var a = '<p>x</p>';</script>" +
      "<!-- note --><p>Kept.</p><table><tr><td><table><tr><td>inner</td></tr></table>outer</td></tr></table><p>Also kept.</p></body></html>";
    assert.equal(htmlToMarkdown(html), "Kept.\n\nAlso kept.\n");
  });

  it("ページ内リンクだけの一覧 (目次) は落とし、ほかの一覧は残す", () => {
    const html =
      '<h2>Contents</h2><ul><li><a href="#s1"><span>Intro</span></a></li><li><a href="#s2">Costs</a></li></ul><ul><li><a href="#s1">Intro</a> and more</li></ul>';
    assert.equal(htmlToMarkdown(html), "## Contents\n\n- Intro and more\n");
  });

  it("一行にページ内リンクだけがある行は落とし、文の中のページ内リンクは文字を残す", () => {
    const html =
      '<p>Updated May 1<br><a href="#Content">Jump to main text</a></p><p>See <a href="#t1">Table 1</a>.</p><p><a href="#a">A</a> and <a href="#b">B</a></p>';
    assert.equal(htmlToMarkdown(html), "Updated May 1\n\nSee Table 1.\n\nA and B\n");
  });

  it("中身の無くなった見出しは、次が同じか上の階層の見出しか文書の終わりなら落とす", () => {
    const html = "<h1>Report</h1><h2>Contents</h2><h2>Tables</h2><h2>Summary</h2><h3>Detail</h3><p>Text.</p><h2>Footnotes</h2>";
    assert.equal(htmlToMarkdown(html), "# Report\n\n## Summary\n\n### Detail\n\nText.\n");
  });

  it("脚注の上付き番号は落とし、ほかの上付き文字は残す", () => {
    assert.equal(htmlToMarkdown('<p>Costs rose.<sup><a href="#fn1" name="ifn1">1</a></sup> The 25<sup>th</sup> year.</p>'), "Costs rose. The 25th year.\n");
  });

  it("タグを外してから文字参照を戻すので、書かれた < > は文字のまま", () => {
    assert.equal(htmlToMarkdown("<p>If a &lt; b &amp;&amp; c&gt;d &mdash; &#x41;&#66;</p>"), "If a < b && c>d — AB\n");
  });
});

describe("decodeEntities", () => {
  it("一度だけ戻す。知らない名前や範囲外の番号は書かれたまま", () => {
    assert.equal(decodeEntities("&amp;lt; &unknown; &#0; &#x110000; &nbsp;&rsquo;"), "&lt; &unknown; &#0; &#x110000;  ’");
  });
});
