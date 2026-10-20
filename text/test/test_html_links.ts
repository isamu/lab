import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { stripTags } from "../packages/chaff/src/html/html-elements.ts";
import { withLinkAddressesMarked, withSectionLinks } from "../packages/chaff/src/html/html-links.ts";
import { htmlToMarkdown } from "../packages/chaff/src/html/html-markdown.ts";
import { decodeEntities } from "../packages/chaff/src/html/markup-text.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// ページのリンクの行き先は、本文の文字を変えずに、そのリンクのある節の終わりの注釈に残す。
// 例文は自作と、米国国立公園局（NPS）の記事（米国政府の著作物、パブリックドメイン）からの抜粋。

/** The lines as the converter hands them on: marked, without tags, character references decoded. */
const lines = (html: string): string[] => decodeEntities(stripTags(withLinkAddressesMarked(html))).split("\n");

describe("withLinkAddressesMarked / withSectionLinks", () => {
  it("http(s) の絶対アドレスは、その節の終わりに注釈で並ぶ。本文の文字は変わらない", () => {
    const marked = lines('See <a href="https://example.org/a">the report</a> and <a href="http://example.org/b">the annex</a>.');
    assert.deepEqual(withSectionLinks(["## A", ...marked, "## B", "x."]), [
      "## A",
      "See the report and the annex.",
      "",
      "<!-- https://example.org/a http://example.org/b -->",
      "",
      "## B",
      "x.",
    ]);
  });

  it("最後の節も、見出しの前の部分も、それぞれ閉じる", () => {
    const opening = lines('<a href="https://example.org/a">Intro</a>');
    const last = lines('<a href="https://example.org/b">Annex</a>');
    assert.deepEqual(withSectionLinks([...opening, "# Title", ...last]), [
      "Intro",
      "",
      "<!-- https://example.org/a -->",
      "",
      "# Title",
      "Annex",
      "",
      "<!-- https://example.org/b -->",
      "",
    ]);
  });

  it("相対アドレス・ページ内・mailto・javascript・文字の無いリンク（画像）は残さない", () => {
    const html = [
      '<a href="/articles/x.htm">Relative</a>',
      '<a href="#top">Top</a>',
      '<a href="mailto:info@example.org">Mail</a>',
      '<a href="javascript:print()">Print</a>',
      '<a href="https://example.org/logo"><img src="logo.png" alt="Logo"></a>',
      '<a href="https://example.org/blank">  </a>',
      "<a>No address</a>",
    ].join("\n");
    assert.deepEqual(withSectionLinks(lines(html)), decodeEntities(stripTags(html)).split("\n"));
  });

  it("文字参照で書かれたアドレスは読んだとおりに（&#x3a; は :、&amp; は &）", () => {
    const html = '<a href="https&#x3a;&#x2f;&#x2f;www.nps.gov&#x2f;media&#x2f;article-search.htm&#x23;q&#x3d;wilderness&amp;p=1">wilderness</a>';
    const kept = withSectionLinks(lines(html));
    assert.equal(kept[0], "wilderness");
    assert.equal(kept[2], "<!-- https://www.nps.gov/media/article-search.htm#q=wilderness&p=1 -->");
  });

  it("空白・山括弧・続く - ・制御文字はエスケープする（注釈が途中で閉じず、印も壊れない）", () => {
    const comment = (href: string): string | undefined => withSectionLinks(lines(`See <a href="${href}">x</a>.`))[2];
    assert.equal(comment("https://example.org/a b?x=-->"), "<!-- https://example.org/a%20b?x=-%2D%3E -->");
    assert.equal(comment("https://example.org/a--b---c"), "<!-- https://example.org/a-%2Db-%2D%2Dc -->");
    assert.equal(comment("https://example.org/a　b"), "<!-- https://example.org/a%E3%80%80b -->");
    assert.equal(comment("https://example.org/a&#5;b&#4;c"), "<!-- https://example.org/a%05b%04c -->");
    assert.equal(withSectionLinks(lines('See <a href="https://example.org/a&#5;b">x</a>.'))[0], "See x.");
  });

  it("リンクの文字の末尾の空白と後ろの空白は 1 つ、行の端の空白は残さない", () => {
    assert.deepEqual(withSectionLinks(lines('the <a href="https://example.org/h">Handbook </a> for')).slice(0, 1), ["the Handbook for"]);
    assert.deepEqual(withSectionLinks(lines('<a href="https://example.org/h">Handbook</a> for')).slice(0, 1), ["Handbook for"]);
    assert.deepEqual(withSectionLinks(lines('see <a href="https://example.org/h">Handbook </a>')).slice(0, 1), ["see Handbook"]);
    assert.deepEqual(withSectionLinks(["Handbook \u0004https://example.org/h\u0005"]).slice(0, 1), ["Handbook"]);
  });

  it("リンクの無い行と空の入力はそのまま", () => {
    assert.deepEqual(withSectionLinks(["# A", "", "x."]), ["# A", "", "x."]);
    assert.deepEqual(withSectionLinks([]), []);
    assert.equal(withLinkAddressesMarked(""), "");
  });
});

// NPS「This is Federal Wilderness」(https://www.nps.gov/articles/federal-wilderness.htm) の 3 節。どの節も他のページにリンクする。
const FEDERAL_WILDERNESS = [
  "<main><h1>This is Federal Wilderness</h1>",
  "<h3>Wilderness is not a pristine and untouched landscape.</h3>",
  "<p>Federal wilderness areas are the homelands of many Indigenous peoples. The rich cultural traditions of Indigenous people, and later immigrants, have existed on and with the landscape long before the establishment of national parks and federal wilderness areas.</p>",
  '<p>Want to learn more about some of these connections? Read about different <a href="https://www.nps.gov/subjects/wilderness/wilderness-heritage.htm">wilderness heritage stories</a>, including <a href="https://www.nps.gov/articles/000/glacier-bay-wilderness-as-homeland.htm">Huna Tlingit views of wilderness as homeland</a> in Glacier Bay National Park and Preserve.</p>',
  "<h3>Yes, people are allowed to go into wilderness.</h3>",
  "<p>People are not only allowed but encouraged to go into federal wilderness! This means recreation is fundamental to wilderness and wilderness recreation opportunities are available to everyone.</p>",
  '<p>For more inspiration, check out this video of a <a href="https://www.nps.gov/media/video/view.htm?id=A1940F19-ECEB-4E27-BF62-19D8D5914B35">family hiking in the wilderness</a> of Zion National Park.</p>',
  "<h3>You don't have to be a mountaineer to enjoy wilderness.</h3>",
  "<p>Mountaineering is welcome, but not required to enjoy the wilderness! Opportunities for exploring wilderness are as diverse as the landscapes and the people of our country.</p>",
  '<p>Whether visiting wilderness for the first time or fifty-fifth time, <a href="https://www.nps.gov/subjects/healthandsafety/trip-planning-guide.htm">planning is key</a> for a fun and safe adventure.</p>',
  "</main>",
].join("");

describe("htmlToMarkdown: リンクの行き先", () => {
  it("NPS の記事: 本文は文字だけ、各節の終わりに行き先", () => {
    const markdown = htmlToMarkdown(FEDERAL_WILDERNESS);
    assert.match(markdown, /Read about different wilderness heritage stories, including Huna Tlingit views of wilderness as homeland in Glacier Bay/u);
    assert.match(
      markdown,
      /Glacier Bay National Park and Preserve\.\n\n<!-- https:\/\/www\.nps\.gov\/subjects\/wilderness\/wilderness-heritage\.htm https:\/\/www\.nps\.gov\/articles\/000\/glacier-bay-wilderness-as-homeland\.htm -->\n\n### Yes/u,
    );
    assert.match(markdown, /safe adventure\.\n\n<!-- https:\/\/www\.nps\.gov\/subjects\/healthandsafety\/trip-planning-guide\.htm -->\n$/u);
  });

  it("NPS の記事: リンクのある節を concrete-evidence-density は指摘しない。リンクを外すと指摘する", () => {
    const flagged = (html: string): string[] =>
      runRules(buildDocument("t.md", htmlToMarkdown(html), en), loadRules(en.id), { "concrete-evidence-density": "strict" }, true, "blog/owned-media")
        .findings.filter((finding) => finding.rule === "concrete-evidence-density")
        .map((finding) => String(finding.values["word"]));
    assert.deepEqual(flagged(FEDERAL_WILDERNESS), []);
    assert.equal(flagged(FEDERAL_WILDERNESS.replace(/<a href="[^"]*">([^<]*)<\/a>/gu, "$1")).length, 3);
  });
});
