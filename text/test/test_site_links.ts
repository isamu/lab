import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { brokenLinks, linkTarget, mirrorGaps, orphanGuidePages, pageOf, type SitePage } from "../scripts/site-links.ts";

// The checks yarn docs:links runs on the built site, on pages made up here.

const ORIGIN = "https://isamu.github.io";
const page = (path: string, hrefs: readonly string[], ids: readonly string[] = []): SitePage => ({ path, hrefs, ids: new Set(ids) });
const details = (problems: readonly { page: string; detail: string }[]): string[] => problems.map((problem) => `${problem.page} ${problem.detail}`);

describe("linkTarget", () => {
  it("resolves a sibling link against the page's folder", () => {
    assert.deepEqual(linkTarget("/lab/ja/guide/a/", "../b/#x", ORIGIN), { path: "/lab/ja/guide/b/", anchor: "x" });
  });
  it("adds the trailing slash a page is served with", () => {
    assert.deepEqual(linkTarget("/lab/ja/guide/a/", "/lab/ja/rules", ORIGIN), { path: "/lab/ja/rules/", anchor: "" });
  });
  it("reads a link to the published site as a link inside it", () => {
    assert.deepEqual(linkTarget("/readme/", "https://isamu.github.io/lab/en/", ORIGIN), { path: "/lab/en/", anchor: "" });
  });
  it("decodes a Japanese anchor", () => {
    assert.equal(linkTarget("/lab/ja/guide/a/", "#%E8%A8%AD%E5%AE%9A", ORIGIN)?.anchor, "設定");
  });
  it("leaves out other sites, mail and files", () => {
    ["https://example.com/", "mailto:a@b.c", "//cdn.example/x", "/lab/_astro/site.css", "../logo.png"].forEach((href) =>
      assert.equal(linkTarget("/lab/ja/guide/a/", href, ORIGIN), undefined, href),
    );
  });
});

describe("brokenLinks", () => {
  const target = page("/lab/ja/guide/b/", [], ["設定"]);
  it("passes a link to a page and an anchor that exist", () => {
    assert.deepEqual(brokenLinks([page("/lab/ja/guide/a/", ["../b/", "../b/#設定", "#"]), target], ORIGIN), []);
  });
  it("finds a link to a page that does not exist", () => {
    assert.deepEqual(details(brokenLinks([page("/lab/ja/guide/a/", ["../c/"]), target], ORIGIN)), ["/lab/ja/guide/a/ ../c/: no such page"]);
  });
  it("finds an anchor the page does not have", () => {
    assert.deepEqual(details(brokenLinks([page("/lab/ja/guide/a/", ["../b/#無い"]), target], ORIGIN)), ["/lab/ja/guide/a/ ../b/#無い: no such anchor"]);
  });
  it("checks an anchor on the same page", () => {
    assert.equal(brokenLinks([page("/lab/ja/guide/a/", ["#x"], ["y"])], ORIGIN).length, 1);
  });
  it("has nothing to say about an empty site", () => {
    assert.deepEqual(brokenLinks([], ORIGIN), []);
  });
});

describe("orphanGuidePages", () => {
  it("finds a guide page that only the menus reach", () => {
    const pages = [page("/lab/ja/guide/a/", ["../b/"]), page("/lab/ja/guide/b/", ["../a/"]), page("/lab/ja/guide/c/", ["../a/"])];
    assert.deepEqual(details(orphanGuidePages(pages, ORIGIN)), ["/lab/ja/guide/c/ no page links here (apart from the menus)"]);
  });
  it("does not count a page's link to itself", () => {
    assert.equal(orphanGuidePages([page("/lab/ja/guide/a/", ["#top", "../a/"])], ORIGIN).length, 1);
  });
  it("counts a link from a rule page", () => {
    assert.deepEqual(orphanGuidePages([page("/lab/ja/guide/a/", []), page("/lab/ja/rules/x/", ["../../guide/a/"])], ORIGIN), []);
  });
  it("leaves pages outside the guide alone", () => {
    assert.deepEqual(orphanGuidePages([page("/lab/ja/rules/x/", [])], ORIGIN), []);
  });
});

describe("mirrorGaps", () => {
  const LANGS = ["ja", "en"] as const;
  it("passes two languages that link to the same pages, anchors apart", () => {
    const pages = [page("/lab/ja/guide/a/", ["../b/#設定", "https://nodejs.org/ja"]), page("/lab/en/guide/a/", ["../b/#configuration", "https://nodejs.org/"])];
    assert.deepEqual(mirrorGaps(pages, ORIGIN, LANGS), []);
  });
  it("finds a link in one language only", () => {
    const pages = [page("/lab/ja/guide/a/", []), page("/lab/en/guide/a/", ["../b/"])];
    assert.deepEqual(details(mirrorGaps(pages, ORIGIN, LANGS)), ["/lab/en/guide/a/ links to /lab/en/guide/b/; the ja page does not"]);
  });
  it("finds a page in one language only", () => {
    assert.deepEqual(details(mirrorGaps([page("/lab/ja/guide/a/", [])], ORIGIN, LANGS)), ["/lab/ja/guide/a/ no en page"]);
    assert.deepEqual(details(mirrorGaps([page("/lab/en/guide/a/", [])], ORIGIN, LANGS)), ["/lab/en/guide/a/ no ja page"]);
  });
});

describe("pageOf", () => {
  it("reads ids, names and links, decoding entities and percent escapes", () => {
    const read = pageOf("/p/", `<h2 id="%E8%A8%AD">x</h2><a name="old"></a><a href="../a/?x=1&amp;y=2">a</a><link rel="alternate" href="/lab/en/">`);
    assert.deepEqual([...read.ids], ["設", "old"]);
    assert.deepEqual(read.hrefs, ["../a/?x=1&y=2", "/lab/en/"]);
  });
  it("reads a page with no links", () => {
    assert.deepEqual(pageOf("/p/", "").hrefs, []);
  });
});
