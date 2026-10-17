import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import type { Span } from "../packages/chaff/src/plugin.ts";
import { citedVenues, codeWords } from "../packages/chaff/src/detectors/acronym-known.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// undefined-acronym and words in capitals the document itself makes known: a keyword of its own code (SELECT, with select
// in the code) and the venue of a talk a link cites ([Jane Roe, FOSDEM 2024](…)). A cloud's name (AWS) is a common acronym. A real
// undefined acronym beside them is still reported. Every example is self-written.

/** The links as chaff reads them from the Markdown. */
const linkSpans = (source: string): readonly Span[] => buildDocument("a.md", source, en).links;

describe("codeWords", () => {
  it("the words fenced and inline code writes in lower case, in capitals", () => {
    const words = codeWords("Text.\n\n```sql\nselect id\nfrom Users\n```\n\nUse `limit 10` here.\n");
    assert.deepEqual(
      [...words].sort((left, right) => left.localeCompare(right)),
      ["FROM", "ID", "LIMIT", "SELECT", "USERS"],
    );
  });

  it("none for a word the code writes in capitals, a part of a name, prose, or an empty document", () => {
    assert.deepEqual([...codeWords("Ask the `TTS` desk. ```\nSELECT 1\n```\n")], []);
    assert.deepEqual([...codeWords("`api_key` `net-http-sspi` `gsa.gov` `--yjit`")], []);
    assert.deepEqual([...codeWords("SELECT is a word here, not code.")], []);
    assert.deepEqual([...codeWords("")], []);
  });
});

describe("citedVenues", () => {
  it("capitals followed by a year in a link's text", () => {
    const source = "As said ([Jane Roe, FOSDEM 2024, 18:10](https://fosdem.org/2024/talk/)) by the XYZ team.";
    assert.deepEqual([...citedVenues(source, linkSpans(source))], ["FOSDEM"]);
    const reference = "It was said at [Jane Roe, FOSDEM 2024][talk].\n\n[talk]: https://fosdem.org/2024/talk/\n";
    assert.deepEqual([...citedVenues(reference, linkSpans(reference))], ["FOSDEM"]);
  });

  it("not capitals with no year, a year outside the link, a number that is no year, or no link", () => {
    const noYear = "See [the XYZ team](https://xyz.org/) and [the SRE notes](https://example.org/sre).";
    assert.deepEqual([...citedVenues(noYear, linkSpans(noYear))], []);
    const outside = "At FOSDEM 2024 ([Jane Roe](https://example.org/talk/)).";
    assert.deepEqual([...citedVenues(outside, linkSpans(outside))], []);
    const notYear = "See [ADR 0010](https://example.org/adr) and [RFC 99999](https://example.org/rfc).";
    assert.deepEqual([...citedVenues(notYear, linkSpans(notYear))], []);
    assert.deepEqual([...citedVenues("No links.", [])], []);
  });
});

describe("undefined-acronym and words the document makes known", () => {
  it("valid: a keyword of the document's code, written in capitals in the prose", () => {
    const source = "# 手引き\n\n単一の表への SELECT でも別名を付ける。SRE が確認する。\n\n```sql\nselect a.id\nfrom users a\n```\n";
    assert.deepEqual(reportedAcronyms(ja, source), ["SRE"]);
  });

  it("valid: a cloud's name, which nobody spells out", () => {
    assert.deepEqual(reportedAcronyms(ja, "---\ntitle: AWSインフラ命名規約\n---\n\nAWS と GCP の資源に名前を付ける。SRE が確認する。\n"), ["SRE"]);
    assert.deepEqual(reportedAcronyms(en, "# Naming guide\n\nName every AWS resource. The SRE checks it.\n"), ["SRE"]);
  });

  it("valid: the venue of a talk a link cites", () => {
    const source = "# Notes\n\nIt was said in a talk ([Jane Roe, FOSDEM 2024](https://fosdem.org/2024/talk/)). The SRE agreed.\n";
    assert.deepEqual(reportedAcronyms(en, source), ["SRE"]);
  });

  it("invalid: the same words without code, in a title, outside a cited link, or a site a link leads to, are still reported", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 手引き\n\n単一の表への SELECT でも別名を付ける。\n"), ["SELECT"]);
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nAsk the XYZ desk (`XYZ`).\n"), ["XYZ"]);
    assert.deepEqual(reportedAcronyms(en, "# The ACME naming guide\n\nName every ACME resource.\n"), ["ACME"]);
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nIt was said at FOSDEM 2024 ([Jane Roe](https://example.org/talk/)).\n"), ["FOSDEM"]);
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nAsk [the XYZ team](https://xyz.org/).\n"), ["XYZ"]);
  });
});
