import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join, normalize } from "node:path";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { crossDocBrokenLink, linkTarget } from "../packages/chaff/src/detectors/cross-link.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { runCli } from "./cli-run.ts";

// cross-doc-broken-link: a relative link between the files of one run whose file or heading is not there. Texts self-written.

const RULE = "cross-doc-broken-link";

/** The link (by its target) and variant of every finding, as path: target (variant). */
const reported = (files: Readonly<Record<string, string>>, adapter: LanguageAdapter = en): string[] =>
  crossDocBrokenLink(
    Object.entries(files).map(([path, source]) => buildDocument(path, source, adapter)),
    { limit: 0 },
  ).map(({ path, finding }) => `${path}: ${String(finding.values["target"])} (${finding.variant ?? ""})`);

describe("cross-doc-broken-link: where a destination leads", () => {
  it("resolves against the linking file's folder, keeps the fragment, and decodes both", () => {
    assert.deepEqual(linkTarget(join("docs", "a.md"), "../b.md#Set%20up"), { file: "b.md", folder: false, fragment: "Set up" });
    assert.deepEqual(linkTarget("a.md", "./guide/"), { file: normalize("guide/"), folder: true, fragment: undefined });
    assert.deepEqual(linkTarget("a.md", "./ref?x=1"), { file: "ref", folder: false, fragment: undefined });
  });

  it("is not a page link for a URL, a root path, a link within the page, or a file that is not Markdown", () => {
    ["https://example.com/a.md", "mailto:a@example.com", "/guide/a", "#setup", "", "./images/a.png", "./script.ts"].forEach((destination) =>
      assert.equal(linkTarget("a.md", destination), undefined, destination),
    );
  });
});

describe("cross-doc-broken-link: what it reports", () => {
  it("a link to a file the run does not have, in a folder the run's files are in", () => {
    assert.deepEqual(reported({ "a.md": "# A\n\nSee [B](./bee.md).\n", "b.md": "# B\n\nText.\n" }), ["a.md: ./bee.md (file)"]);
  });

  it("a link to a heading the target file does not have", () => {
    assert.deepEqual(reported({ "a.md": "# A\n\nSee [setup](./b.md#install).\n", "b.md": "# B\n\n## Setup\n\nText.\n" }), ["a.md: ./b.md#install (anchor)"]);
  });

  it("a Japanese heading anchor, compared on letters and digits", () => {
    const files = { "a.md": "# A\n\n[準備](./b.md#準備しよう)と[手順](./b.md#手順-1)\n", "b.md": "# B\n\n## 準備する\n\n## 手順 1\n" };
    assert.deepEqual(reported(files, ja), ["a.md: ./b.md#準備しよう (anchor)"]);
  });

  it("a missing file with a fragment is reported as a missing file", () => {
    assert.deepEqual(reported({ "a.md": "[x](./c.md#top)\n", "b.md": "text\n" }), ["a.md: ./c.md#top (file)"]);
  });
});

describe("cross-doc-broken-link: what it leaves alone", () => {
  it("a link found with an extension added, as a folder's page, or with its heading written differently", () => {
    const files = {
      "a.md": "# A\n\n[b](./b) [g](./guide) [s](./b.md#SET-UP!) [top](./b.md#) [idx](guide/index.md)\n",
      "b.md": "# B\n\n## Set up\n",
      [join("guide", "index.md")]: "# Guide\n",
    };
    assert.deepEqual(reported(files), []);
  });

  it("a missing file in a folder none of the run's files are in, or a link to a folder", () => {
    assert.deepEqual(reported({ "a.md": "[x](../other/x.md) [y](./sub/y.md) [z](./docs/)\n", "b.md": "text\n" }), []);
  });

  it("a link to a folder written without a slash, when the run has pages in it", () => {
    assert.deepEqual(reported({ "a.md": "[s](./sub)\n", [join("sub", "page.md")]: "text\n" }), []);
  });

  it("links in a text file, and links within the page", () => {
    assert.deepEqual(reported({ "a.txt": "[x](./nope.md)\n", "b.md": "# B\n\n[c](#nowhere)\n" }), []);
  });
});

describe("cross-doc-broken-link: on the command line", () => {
  const FILES = {
    "chaff.yaml": "language: en\ngenre: docs/manual\n",
    "a.md": "# A\n\nRead [setup](./b.md#install) first.\n",
    "b.md": "# B\n\n## Setup\n\nGather the tools.\n",
  };

  it("runs over two files, reports in the linking file, and writes it to SARIF there", async () => {
    const run = await runCli(FILES, ["a.md", "b.md", "--experimental", "--compact", "--sarif", "out.sarif"], "en_US.UTF-8");
    const sarif = readFileSync(join(run.dir, "out.sarif"), "utf8");
    rmSync(run.dir, { recursive: true, force: true });
    assert.match(run.out, /3:6 +warning The link "\[setup\]\(\.\/b\.md#install\)" points to "\.\/b\.md#install", but that file has no such heading/u);
    assert.match(sarif, /"ruleId": "chaff\/cross-doc-broken-link"[\s\S]*"uri": "a\.md"/u);
  });

  it("on one file, lists the rule as not run and says why", async () => {
    const run = await runCli(FILES, ["a.md", "--experimental"], "en_US.UTF-8");
    rmSync(run.dir, { recursive: true, force: true });
    assert.match(run.out, /cross-doc-broken-link \(it compares documents, and there is only one to compare/u);
  });

  it("a stet in the linking file silences it, and the baseline shelves it", async () => {
    const stetted = { ...FILES, "a.md": `# A\n\n<!-- stet: ${RULE} — the heading comes in the next release -->\nRead [setup](./b.md#install) first.\n` };
    const silenced = await runCli(stetted, ["a.md", "b.md", "--experimental", "--compact"], "en_US.UTF-8");
    rmSync(silenced.dir, { recursive: true, force: true });
    assert.doesNotMatch(silenced.out, new RegExp(RULE, "u"));
    const shelved = await runCli({ ...FILES, ".chaff-baseline.json": "" }, ["baseline", "a.md", "b.md", "--experimental"], "en_US.UTF-8");
    const baseline = readFileSync(join(shelved.dir, ".chaff-baseline.json"), "utf8");
    rmSync(shelved.dir, { recursive: true, force: true });
    const after = await runCli({ ...FILES, ".chaff-baseline.json": baseline }, ["a.md", "b.md", "--experimental", "--compact"], "en_US.UTF-8");
    rmSync(after.dir, { recursive: true, force: true });
    assert.doesNotMatch(after.out, new RegExp(RULE, "u"));
    assert.match(baseline, /"entries": \[\n {4}"/u);
  });
});
