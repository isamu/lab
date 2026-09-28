import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { docEntries, docPath, parsedAs, storedText, summaryChanges, summaryLine, updatedSummary, type DocEntry } from "../scripts/corpus-docs.ts";

// コーパスの法令以外の文書。どこに置くか、rule ごとの数の一行、前回との違い。

const entry = (overrides: Partial<DocEntry> = {}): DocEntry => ({
  id: "d",
  title: "D",
  genre: "technical/spec",
  language: "en",
  url: "https://example.com/a/d.md",
  license: "CC0-1.0",
  redistribute: false,
  ...overrides,
});

describe("docEntries", () => {
  it("URL で取る文書だけを読み、欠けた項目のあるものは読まない", () => {
    const manifest = {
      documents: [
        { ...entry(), source: "url" },
        { ...entry({ id: "law" }), source: "e-gov" },
        { ...entry({ id: "no-genre" }), genre: "", source: "url" },
        { ...entry({ id: "no-flag" }), redistribute: "yes", source: "url" },
      ],
    };
    assert.deepEqual(
      docEntries(manifest).map((doc) => doc.id),
      ["d"],
    );
    assert.deepEqual(docEntries(undefined), []);
    assert.deepEqual(docEntries({ documents: "x" }), []);
  });

  it("format は無いか、変換できる形式 (wikitext / html) のときだけ読む", () => {
    const manifest = {
      documents: [
        { ...entry({ id: "plain" }), source: "url" },
        { ...entry({ id: "wiki" }), format: "wikitext", source: "url" },
        { ...entry({ id: "page" }), format: "html", source: "url" },
        { ...entry({ id: "pdf" }), format: "pdf", source: "url" },
        { ...entry({ id: "inherited" }), format: "toString", source: "url" },
        { ...entry({ id: "number" }), format: 1, source: "url" },
      ],
    };
    assert.deepEqual(
      docEntries(manifest).map((doc) => doc.id),
      ["plain", "wiki", "page"],
    );
  });
});

describe("storedText", () => {
  it("format の無い文書は取ったまま、ある文書は Markdown に変えて置く", () => {
    assert.equal(storedText(entry(), "== A ==\n"), "== A ==\n");
    assert.equal(storedText(entry({ format: "wikitext" }), "== A ==\n"), "## A\n");
    assert.equal(storedText(entry({ format: "html" }), "<h2>A</h2>"), "## A\n");
  });
});

describe("docPath / parsedAs", () => {
  it("再配布できるものは docs/、できないものは .cache/。.txt の URL は .txt、ほかは chaff . に拾われない .source", () => {
    assert.equal(docPath("/c", entry({ redistribute: true })), join("/c", "docs", "d.source"));
    assert.equal(docPath("/c", entry()), join("/c", ".cache", "d.source"));
    assert.equal(docPath("/c", entry({ url: "https://example.com/rfc1.txt" })), join("/c", ".cache", "d.txt"));
    assert.equal(docPath("/c", entry({ url: "https://example.com/pep.rst" })), join("/c", ".cache", "d.source"));
  });

  it("読むときは、テキストは .txt、ほかは Markdown として .md の名前で読む", () => {
    assert.equal(parsedAs(entry()), "d.md");
    assert.equal(parsedAs(entry({ url: "https://example.com/pep.rst" })), "d.md");
    assert.equal(parsedAs(entry({ url: "https://example.com/rfc1.txt?x=1" })), "d.txt");
  });
});

describe("summaryLine", () => {
  it("rule ごとの数を rule の id 順に並べる。何も無ければ clean", () => {
    assert.equal(summaryLine("d", ["b-rule", "a-rule", "b-rule"]), "d  a-rule 1, b-rule 2");
    assert.equal(summaryLine("d", []), "d  clean");
  });
});

describe("summaryChanges / updatedSummary", () => {
  const expected = ["a  clean", "b  x 1", "c  y 2"];
  const known = new Set(["0", "a", "b", "c", "d"]);

  it("変わった行と新しい行だけを出す。取っていない文書は比べない", () => {
    assert.deepEqual(summaryChanges(expected, ["a  clean", "b  x 2", "d  z 1"], known), ["- b  x 1", "+ b  x 2", "+ d  z 1"]);
    assert.deepEqual(summaryChanges(expected, ["a  clean"], known), []);
    assert.deepEqual(summaryChanges([], [], known), []);
  });

  it("manifest から消えた文書の行は、取っていなくても違いとして出す", () => {
    assert.deepEqual(summaryChanges(expected, ["a  clean"], new Set(["a", "b"])), ["- c  y 2"]);
  });

  it("受け入れると、実行した文書の行だけを置き換え、取っていない文書の行は残し、消えた文書の行は落として id 順に並べる", () => {
    assert.deepEqual(updatedSummary(expected, ["b  x 2", "0  new 1"], known), ["0  new 1", "a  clean", "b  x 2", "c  y 2"]);
    assert.deepEqual(updatedSummary(expected, [], new Set(["a"])), ["a  clean"]);
    assert.deepEqual(updatedSummary([], [], known), []);
  });
});
