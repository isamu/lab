import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withLostParagraphTagsRestored } from "../scripts/html-lost-tags.ts";
import { htmlToMarkdown } from "../scripts/html-markdown.ts";

// 16 CFR 310.4(b)（米国連邦規則、パブリックドメイン）を縮めたもの。eCFR は (2) の段落を開く <P> の "<" を落として配っている。
const ECFR =
  '<main><p class="indent-4">(D) This <a href="#p-310.4(v)">paragraph (v)</a> shall not apply, as defined in <a href="/title-45">45 CFR 160.103</a>. P&gt;(2) It is an abusive telemarketing act or practice to sell any list.</p></main>';

describe("withLostParagraphTagsRestored", () => {
  [
    ["文の終わりの後ろ、(2) の前", "shall apply. P&gt;(2) It is", "shall apply. <p>(2) It is"],
    ["エスケープされていない >", "shall apply. P>(2) It is", "shall apply. <p>(2) It is"],
    [
      "セミコロンの後ろと、閉じ引用符の後ろ、ローマ数字と大文字の番号",
      'the list"; p&gt;(iv) and so." P&gt;(A) Next',
      'the list"; <p>(iv) and so." <p>(A) Next',
    ],
  ].forEach(([form, html, restored]) => {
    it(`valid: ${String(form)}`, () => assert.equal(withLostParagraphTagsRestored(String(html)), restored));
  });

  [
    ["p 値", "was significant. P&gt;0.05 in both groups"],
    ["空白を挟んだ比較", "then. P &gt; (2) holds"],
    ["文の途中", "the ratio P&gt;(2) holds"],
    ["番号の後ろに空白が無い", "shall apply. P&gt;(2)It is"],
    ["番号が長すぎる", "shall apply. P&gt;(12345) It is"],
    ["タグの属性の中", '<a title="shall apply. P&gt;(2) It is">x</a>'],
  ].forEach(([form, html]) => {
    it(`invalid: ${String(form)}`, () => assert.equal(withLostParagraphTagsRestored(String(html)), String(html)));
  });

  it("異常な入力: 空文字、P> だけ", () => {
    assert.equal(withLostParagraphTagsRestored(""), "");
    assert.equal(withLostParagraphTagsRestored("P&gt;"), "P&gt;");
  });
});

describe("htmlToMarkdown と落ちた段落のタグ", () => {
  it("(2) は前の段落から分かれて行頭に立ち、P> は残らない", () => {
    assert.equal(
      htmlToMarkdown(ECFR),
      "(D) This paragraph (v) shall not apply, as defined in 45 CFR 160.103.\n\n(2) It is an abusive telemarketing act or practice to sell any list.\n",
    );
  });
});
