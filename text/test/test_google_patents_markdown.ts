import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { googlePatentsToMarkdown } from "../scripts/google-patents-markdown.ts";
import { storedText, type DocEntry } from "../scripts/corpus-docs.ts";

// Google Patents の特許のページから、特許そのものの文（要約・明細書・請求の範囲）だけを Markdown に。例文はすべて自作。

const page = (sections: string): string =>
  [
    "<html><head><title>US0000000 - A cup - Google Patents</title></head><body>",
    '<section itemprop="metadata"><h2>Info</h2><dl><dt>Publication number</dt><dd>US0000000</dd></dl></section>',
    sections,
    '<section itemprop="family"><h2>Family Cites Families (2)</h2><p>2015 US active</p></section>',
    "</body></html>",
  ].join("\n");

const ABSTRACT = '<section itemprop="abstract"><h2>Abstract</h2><div class="abstract">A cup with a lid.</div></section>';
const DESCRIPTION =
  '<section itemprop="description"><h2>Description</h2><div class="description"><heading>BACKGROUND</heading><div class="description-paragraph">Cups spill.</div></div></section>';
const CLAIMS =
  '<section itemprop="claims"><h2>Claims (1)</h2><div class="claims"><claim-statement>We claim:</claim-statement><div class="claim"><div class="claim-text">1. A cup, comprising:<div class="claim-text">a lid.</div></div></div></div></section>';

describe("googlePatentsToMarkdown: 特許の文だけを残す", () => {
  it("要約・明細書・請求の範囲を順に残し、書誌・引用・ファミリーは落とす", () => {
    assert.equal(
      googlePatentsToMarkdown(page([ABSTRACT, DESCRIPTION, CLAIMS].join("\n"))),
      "## Abstract\n\nA cup with a lid.\n\n## Description\n\n### BACKGROUND\n\nCups spill.\n\n## Claims (1)\n\nWe claim:\n\n1. A cup, comprising:\n\na lid.\n",
    );
  });

  it("明細書の <heading> は見出しになる", () => {
    assert.match(googlePatentsToMarkdown(page(DESCRIPTION)), /^### BACKGROUND$/mu);
  });

  it("入れ子の section があっても、外側の section の終わりまで読む", () => {
    const nested = '<section itemprop="description"><h2>Description</h2><section><p>Inner.</p></section><p>After the inner one.</p></section>';
    assert.equal(googlePatentsToMarkdown(page(nested)), "## Description\n\nInner.\n\nAfter the inner one.\n");
  });

  it("ページの並びがどうでも、要約・明細書・請求の範囲の順に並べる", () => {
    assert.equal(googlePatentsToMarkdown(page([CLAIMS, ABSTRACT].join("\n"))).indexOf("## Abstract"), 0);
  });

  it("特許の文が一つも無いページ（閉じていない section も含む）は、黙って空にせず投げる", () => {
    assert.throws(() => googlePatentsToMarkdown(page("")), /no abstract, description or claims/u);
    assert.throws(() => googlePatentsToMarkdown('<section itemprop="claims"><h2>Claims</h2><p>1. A cup.</p>'), /no abstract/u);
    assert.throws(() => googlePatentsToMarkdown(""), /no abstract/u);
  });

  it("itemprop の名前が似ているだけの section は拾わない", () => {
    assert.throws(() => googlePatentsToMarkdown('<section itemprop="claimsSummary"><p>x</p></section>'), /no abstract/u);
  });

  it("manifest の format google-patents でこの変換を使う", () => {
    const entry: DocEntry = {
      id: "p",
      title: "P",
      genre: "technical/spec",
      language: "en",
      url: "https://example.com/patent/US0000000/en",
      license: "Public domain",
      redistribute: true,
      format: "google-patents",
    };
    assert.equal(storedText(entry, page(ABSTRACT)), "## Abstract\n\nA cup with a lid.\n");
  });
});
