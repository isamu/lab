import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { htmlToMarkdown } from "../packages/chaff/src/html/html-markdown.ts";
import { withoutSiteChrome } from "../packages/chaff/src/html/html-site-chrome.ts";

const page = (chrome: string, after = ""): string =>
  `<html><body>${chrome}<div><h1>Notice</h1><p>The office opens at nine.</p><p>Bring the form with you.</p></div>${after}</body></html>`;

const BODY = "# Notice\n\nThe office opens at nine.\n\nBring the form with you.\n";

describe("withoutSiteChrome, through htmlToMarkdown", () => {
  it("drops the U.S. government's .gov banner by its class", () => {
    const banner = `<section class="usa-banner" aria-label="Official website of the United States government"><header class="usa-banner__header"><p>An official website of the United States government</p></header><div><h2>Official websites use .gov</h2><p>A .gov website belongs to an official government organization.</p></div></section>`;
    assert.equal(htmlToMarkdown(page(banner)), BODY);
  });

  it("drops a breadcrumb trail named by a CMS convention, also after the content", () => {
    const trail = `<div id="foot_pankuzu"><ul><li><a href="/">トップページ</a></li><li><a href="/soshiki/">組織から探す</a></li><li>Notice</li></ul></div>`;
    assert.equal(htmlToMarkdown(page("", trail)), BODY);
    assert.equal(htmlToMarkdown(page(`<p class="topicpath">Home &gt; Notices</p>`)), BODY);
    assert.equal(htmlToMarkdown(page(`<div class="breadcrumbs">Home / Notices / Notice</div>`)), BODY);
  });

  it("drops a search box whose form is gone, by its name, its role or the <search> element", () => {
    const box = `<div id="top_search_box2"><fieldset><legend>検索対象</legend><label>すべて</label><label>PDF</label></fieldset><label>ページIDを入力</label></div>`;
    assert.equal(htmlToMarkdown(page(box)), BODY);
    assert.equal(htmlToMarkdown(page(`<div role="search"><label>Search this site</label></div>`)), BODY);
    assert.equal(htmlToMarkdown(page(`<search><label>Search this site</label></search>`)), BODY);
  });

  it("drops the page's header and footer blocks and landmarks", () => {
    assert.equal(htmlToMarkdown(page(`<div id="header"><span>よりそう想い 広がる絆</span></div>`)), BODY);
    assert.equal(htmlToMarkdown(page("", `<div id="footer"><p>City Hall, 1-3-20 Nakanoshima. Open 9:00 to 17:30.</p></div>`)), BODY);
    assert.equal(htmlToMarkdown(page(`<header><p>City of Example. Welcome.</p></header>`)), BODY);
    assert.equal(htmlToMarkdown(page("", `<div role="contentinfo"><p>City Hall. Open 9:00 to 17:30.</p></div>`)), BODY);
  });

  it("keeps a block that holds the page's title, whatever it is named", () => {
    const html = `<html><body><header class="header"><h1>Notice</h1><p>The office opens at nine.</p></header></body></html>`;
    assert.equal(htmlToMarkdown(html), "# Notice\n\nThe office opens at nine.\n");
  });

  it("keeps a <header> inside an article or a section, and names that only contain a chrome word", () => {
    const html = `<html><body><article><header><p>Published by the office.</p></header><h1>Notice</h1><div class="research"><p>The office opens at nine.</p></div></article></body></html>`;
    assert.match(htmlToMarkdown(html), /Published by the office\./u);
    const research = `<html><body><div><h1>Notice</h1><div class="research"><p>The office opens at nine.</p></div><div id="headerless"><p>Bring the form.</p></div></div></body></html>`;
    assert.equal(htmlToMarkdown(research), "# Notice\n\nThe office opens at nine.\n\nBring the form.\n");
  });

  it("leaves markup without chrome as it is", () => {
    const html = `<div class="content"><p>Text.</p></div>`;
    assert.equal(withoutSiteChrome(html), html);
    assert.equal(withoutSiteChrome(""), "");
  });
});
