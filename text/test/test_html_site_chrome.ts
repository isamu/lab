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

  it("drops a search form and a small search block with an input, whatever the block is named", () => {
    assert.equal(htmlToMarkdown(page(`<form class="search-form" action="/search"><input type="text" name="q"><button>Go</button></form>`)), BODY);
    assert.equal(htmlToMarkdown(page(`<div class="site-search"><p>Search the site</p><input type="search" name="q"></div>`)), BODY);
    assert.equal(htmlToMarkdown(page(`<div role="search"><p>Find a service.</p><input name="q"></div>`)), BODY);
    const menu = `<div class="search_blog"><p>カテゴリから探す</p><ul><li><a href="/tag/a.html">お知らせ</a></li><li><a href="/tag/b.html">催し</a></li></ul></div>`;
    assert.equal(htmlToMarkdown(page(menu)), BODY);
    assert.equal(htmlToMarkdown(page(`<div class="site-search"><a href="/">Home.</a> <a href="/news">News.</a> <a href="/faq">Help.</a></div>`)), BODY);
  });

  it("keeps a block named search that holds prose, such as a results page", () => {
    const results = `<div class="search-results"><h2>Results for permits</h2><p>Building permits are issued by the city. Apply at least two weeks ahead.</p><p>Parking permits are issued by the police.</p></div>`;
    const kept = htmlToMarkdown(page("", results));
    assert.match(kept, /Building permits are issued by the city\./u);
    assert.match(kept, /Parking permits are issued by the police\./u);
    const withInput = `<div id="search"><input name="q"><p>The search covers every notice. Older notices are in the archive.</p></div>`;
    assert.match(htmlToMarkdown(page("", withInput)), /Older notices are in the archive\./u);
    const landmark = `<search><p>Search covers the notices. Older ones are archived.</p></search>`;
    assert.match(htmlToMarkdown(page("", landmark)), /Older ones are archived\./u);
  });

  it("keeps a search-named block without a control, and drops a search landmark without prose", () => {
    assert.match(htmlToMarkdown(page("", `<div class="search-tips"><p>Use quotes for a phrase.</p></div>`)), /Use quotes for a phrase\./u);
    assert.equal(htmlToMarkdown(page(`<div role="search"><a href="/find">Advanced search</a></div>`)), BODY);
  });

  it("keeps a page-level header block that holds a heading followed by prose", () => {
    const header = `<header><h2>About this notice</h2><p>The office publishes notices every week.</p></header>`;
    assert.match(htmlToMarkdown(page(header)), /The office publishes notices every week\./u);
    const named = `<div id="header"><h3>Scope</h3><p>This notice covers the north office.</p></div>`;
    assert.match(htmlToMarkdown(page(named)), /This notice covers the north office\./u);
  });

  it("drops a header whose heading is followed only by links or by no sentence", () => {
    const menu = `<header><h2>City of Example</h2><ul><li><a href="/">Home.</a></li><li><a href="/news">News.</a></li></ul></header>`;
    assert.equal(htmlToMarkdown(page(menu)), BODY);
    assert.equal(htmlToMarkdown(page(`<div class="header"><h2>City of Example</h2><span>Welcome</span></div>`)), BODY);
    assert.equal(htmlToMarkdown(page(`<div id="header"><p>Welcome to the city.</p><h2>City of Example</h2></div>`)), BODY);
    assert.equal(htmlToMarkdown(page(`<header><h2>Site navigation</h2><h3>Home.</h3><h3>News.</h3></header>`)), BODY);
  });

  it("leaves markup without chrome as it is", () => {
    const html = `<div class="content"><p>Text.</p></div>`;
    assert.equal(withoutSiteChrome(html), html);
    assert.equal(withoutSiteChrome(""), "");
  });
});
