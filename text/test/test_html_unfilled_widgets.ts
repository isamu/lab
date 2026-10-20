import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withoutUnfilledWidgets } from "../packages/chaff/src/html/html-widgets.ts";
import { htmlToMarkdown } from "../packages/chaff/src/html/html-markdown.ts";

// ページが隠し、スクリプトが中身を入れてから見せる塊（関連ページの枠）は落とす。言葉ではなく作りで見分ける。
// NPS の記事 (https://www.nps.gov/articles/federal-wilderness.htm、米国政府の著作物) の作りを縮めたものと自作の例。

const ARTICLE = "<main><h1>This is Federal Wilderness</h1><p>Wilderness gives us a place to unplug.</p>";

// NPS の「You Might Also Like」: display:none の枠に見出し・空の行・結果を描くスクリプト・読み込み中の文字。
const RELATED =
  '<div class="Component RelatedGrid" id="related_1" style="display:none;"><h2 class="RelatedGrid__Heading Tag">You Might Also Like</h2>' +
  "<div class=\"row\"></div><script>itemHTML += '<div class=\"Component RelatedGridItem\">'; itemHTML += '</a></div>';</script>" +
  '<div id="searchListing-1"><div class="results"><div class="ListingResults-loading">Loading results...</div><ul class="resultsUL"></ul></div></div></div>';

const TAGS = '<div class="SharedContentTags"><h2>Tags</h2><p>Last updated: May 16, 2024</p></div></main>';

describe("withoutUnfilledWidgets", () => {
  it("NPS の関連ページの枠（隠れていて、スクリプトを持つ）は落とし、後ろの本文は残す", () => {
    assert.equal(
      htmlToMarkdown(`${ARTICLE}${RELATED}${TAGS}`),
      "# This is Federal Wilderness\n\nWilderness gives us a place to unplug.\n\n## Tags\n\nLast updated: May 16, 2024\n",
    );
  });

  it("隠れていて見出ししか持たない枠（おすすめページの見出しだけ）は落とす", () => {
    const recommend =
      '<div id="recommend_tag" style="display: none;"><div><div><h2><span>このページを見ている人は</span><span>こんなページも見ています</span></h2></div></div></div>';
    assert.equal(htmlToMarkdown(`<main><h1>創業支援</h1><p>本文です。</p>${recommend}</main>`), "# 創業支援\n\n本文です。\n");
  });

  it("隠れていても自分の文字があってスクリプトの無い塊（開くと見える答え・所属）は残す", () => {
    const answer = '<h3>Who may apply?</h3><div class="accordion_body" style="display: none;"><p>Any resident may apply.</p></div>';
    assert.equal(htmlToMarkdown(`<main><h1>FAQ</h1>${answer}</main>`), "# FAQ\n\n### Who may apply?\n\nAny resident may apply.\n");
    const headed = '<div style="display:none"><h3>Note</h3><p>Fees apply.</p></div>';
    assert.equal(withoutUnfilledWidgets(headed), headed);
  });

  it("隠れていない枠・スクリプトを持つだけの見える塊はそのまま。display:none 以外の style も対象外", () => {
    const shown = '<div style="display:block"><h2>Related</h2><script>x()</script></div>';
    assert.equal(withoutUnfilledWidgets(shown), '<div style="display:block"><h2>Related</h2><script></script></div>');
    const visible = '<div class="widget"><h2>Related</h2></div>';
    assert.equal(withoutUnfilledWidgets(visible), visible);
    assert.equal(withoutUnfilledWidgets('<div style="color: none"><h2>x</h2></div>'), '<div style="color: none"><h2>x</h2></div>');
    assert.equal(withoutUnfilledWidgets(""), "");
    for (const style of ["display:none-ish", "x-display:none", "display:nonexistent"]) {
      const html = `<div style="${style}"><h2>Related</h2></div>`;
      assert.equal(withoutUnfilledWidgets(html), html, style);
    }
  });

  it("display:none の書き方の違い（大文字・!important・ほかの宣言の間・単引用符・前に別の属性）は同じに読む", () => {
    for (const opening of [
      '<div style="DISPLAY: NONE">',
      '<div style="color:red; display:none !important; margin:0">',
      "<div style='display:none;'>",
      '<div class="box" id="r" style="display:none">',
    ]) {
      assert.equal(withoutUnfilledWidgets(`${opening}<h2>Related</h2></div><p>Kept.</p>`), " <p>Kept.</p>", opening);
    }
  });

  it("データのスクリプト（JSON-LD・テンプレート）は中身を入れる印ではない。JavaScript の type・module は印", () => {
    const withData = '<div style="display:none"><p>Fees apply.</p><script type="application/ld+json">{"x":1}</script></div>';
    assert.equal(withoutUnfilledWidgets(withData), '<div style="display:none"><p>Fees apply.</p><script type="application/ld+json"></script></div>');
    for (const type of ["text/javascript", "application/javascript", "module"]) {
      const html = `<div style="display:none"><p>Loading.</p><script type="${type}">x()</script></div>`;
      assert.equal(withoutUnfilledWidgets(html), " ", type);
    }
  });

  it("スクリプトの文字の中のタグで塊の区切りを読み違えない", () => {
    const html = `<div style='display:none'><h2>Related</h2><script>s = '<div>';</script></div><p>Kept.</p>`;
    assert.equal(withoutUnfilledWidgets(html), " <p>Kept.</p>");
  });
});
