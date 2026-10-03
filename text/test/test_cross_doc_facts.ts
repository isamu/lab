import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { crossDocFactConflict } from "../packages/chaff/src/detectors/cross-facts.ts";
import { crossDocDuplicateDefinition } from "../packages/chaff/src/detectors/cross-definitions.ts";
import { definitionKey } from "../packages/chaff/src/structure/cross-definitions.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { CrossDetector, LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { runCli } from "./cli-run.ts";

// cross-doc-fact-conflict and cross-doc-duplicate-definition: an item given, or a term defined, differently in different
// files of one run. Texts self-written.

const run = (detector: CrossDetector, files: Readonly<Record<string, string>>, adapter: LanguageAdapter): string[] =>
  detector(
    Object.entries(files).map(([path, source]) => buildDocument(path, source, adapter)),
    { limit: 0 },
  ).map(({ path, finding }) => {
    const values = Object.entries(finding.values)
      .filter(([key]) => key !== "offset")
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(" ");
    return `${path}@${String(finding.values["offset"])} ${values}`;
  });

const facts = (files: Readonly<Record<string, string>>, adapter: LanguageAdapter = en): string[] => run(crossDocFactConflict, files, adapter);

describe("cross-doc-fact-conflict: what it reports", async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });

  it("the file whose value fewer files give, at its value, naming the usual value and a file that gives it", () => {
    const files = { "a.md": "# A\n\nMonthly fee: $12\n", "b.md": "# B\n\nMonthly fee: $15\n", "c.md": "# C\n\nMonthly fee: $12\n" };
    assert.deepEqual(facts(files), ["b.md@18 label=Monthly fee value=$15 other=$12 count=2 example=a.md"]);
  });

  it("Japanese labels and values, width aside", () => {
    const files = { "a.md": "# 料金\n\n月額料金：1,200円\n", "b.md": "# 質問\n\n月額料金：1,500円\n", "c.md": "# 概要\n\n月額料金: 1200円\n" };
    assert.deepEqual(facts(files, ja), ["b.md@11 label=月額料金 value=1,500円 other=1,200円 count=2 example=a.md"]);
  });

  it("an email address and a version of three parts", () => {
    const files = {
      "a.md": "# A\n\nContact: help@example.com\n\nVersion: 2.4.1\n",
      "b.md": "# B\n\nContact: sales@example.com\n\nVersion: 2.4.1\n",
      "c.md": "# C\n\nContact: help@example.com\n\nVersion: 2.5.0\n",
    };
    assert.deepEqual(facts(files), [
      "b.md@14 label=Contact value=sales@example.com other=help@example.com count=2 example=a.md",
      "c.md@41 label=Version value=2.5.0 other=2.4.1 count=2 example=a.md",
    ]);
  });

  it("a table cell under the same header", () => {
    const table = (fee: string): string => `# T\n\n| Plan | Monthly fee |\n| --- | --- |\n| Basic | ${fee} |\n`;
    assert.deepEqual(facts({ "a.md": table("$12"), "b.md": table("$15"), "c.md": table("$12") }).length, 1);
  });
});

describe("cross-doc-fact-conflict: what it leaves alone", () => {
  it("a value in a sentence rather than an entry", () => {
    assert.deepEqual(facts({ "a.md": "# A\n\nThe fee is $12.\n", "b.md": "# B\n\nThe fee is $15.\n", "c.md": "# C\n\nThe fee is $12.\n" }), []);
  });

  it("values that split three ways, values in different units, and agreeing values", () => {
    assert.deepEqual(facts({ "a.md": "Fee: $12\n", "b.md": "Fee: $15\n", "c.md": "Fee: $18\n" }), []);
    assert.deepEqual(facts({ "a.md": "Fee: $12\n", "b.md": "Fee: 12 EUR\n" }), []);
    const date = "Deadline: May 3, 2026\n";
    assert.deepEqual(facts({ "a.md": date, "b.md": "Deadline: 12\n", "c.md": date }), []);
    assert.deepEqual(facts({ "a.md": date, "b.md": "Deadline: May 5, 2026\n", "c.md": date }).length, 1);
    assert.deepEqual(facts({ "a.md": "Fee: $12\n", "b.md": "Fee: $12.00\n" }), []);
  });

  it("record fields (one name at the start of many lines) do not vote, even when they agree", () => {
    const records = "# Events\n\nFee: $12\n\nFee: $12\n\nFee: $12\n";
    assert.deepEqual(facts({ "a.md": records, "b.md": "Fee: $15\n", "c.md": "Fee: $15\n" }), []);
  });

  it("a file that gives the item two values does not vote", () => {
    const files = { "a.md": "# A\n\n## Basic\n\nFee: $12\n\n## Pro\n\nFee: $30\n", "b.md": "Fee: $30\n", "c.md": "Fee: $12\n" };
    assert.deepEqual(facts(files), ["c.md@5 label=Fee value=$12 other=$30 count=1 example=b.md"]);
  });
});

const definitions = (files: Readonly<Record<string, string>>, adapter: LanguageAdapter = en): string[] => run(crossDocDuplicateDefinition, files, adapter);

describe("cross-doc-duplicate-definition", () => {
  it("the file that defines a term in other words than most files", () => {
    const files = {
      "a.md": '"Member" means a person invited to a workspace.\n',
      "b.md": '"Member" means a person who pays the fee.\n',
      "c.md": '"Member" means a person invited to a workspace.\n',
    };
    assert.deepEqual(definitions(files), ["b.md@0 term=Member count=2 example=a.md"]);
  });

  it("Japanese, width, spaces and the punctuation at the ends aside", () => {
    const files = {
      "a.md": "「メンバー」とは、ワークスペースに招かれた人のことです。\n",
      "b.md": "「メンバー」とは ワークスペースに招かれた人のことです\n",
      "c.md": "「メンバー」とは、料金を払った人のことです。\n",
    };
    assert.deepEqual(definitions(files, ja), ["c.md@0 term=メンバー count=2 example=a.md"]);
  });

  it("not a sentence that names the term without the words of a definition", () => {
    const files = { "a.md": "「AI が書いた」とは言いません。\n", "b.md": "「AI が書いた」とは判定しません。\n" };
    assert.deepEqual(definitions(files, ja), []);
    const defined = "「AI が書いた」とは、生成された文のことです。\n";
    assert.deepEqual(definitions({ "a.md": "「AI が書いた」とは言いません。\n", "b.md": defined, "c.md": defined }, ja), []);
  });

  it("not a definition limited to a part, nor one with its meaning before the term", () => {
    const local = { "a.md": "この条において「会員」とは、登録した人をいう。\n", "b.md": "「会員」とは、料金を払った人をいう。\n" };
    assert.deepEqual(definitions(local, ja), []);
    const inline = {
      "a.md": "株式会社みなと（以下「売主」という。）が納める部品のことです。\n",
      "b.md": "株式会社はまべ（以下「売主」という。）が送る品のことです。\n",
    };
    assert.deepEqual(definitions(inline, ja), []);
  });

  it("definitionKey evens out width, spaces and the punctuation at the ends", () => {
    assert.equal(definitionKey("、ＡＢＣ  の 場所。"), "ABC の 場所");
    assert.equal(definitionKey(" 。"), "");
  });
});

describe("on the command line", () => {
  it("both rules report in the file out of step", async () => {
    const files = {
      "chaff.yaml": "language: ja\ngenre: docs/manual\n",
      "a.md": "# 用語集\n\n「メンバー」とは、ワークスペースに招かれた人のことです。\n\n月額料金：1,200円\n",
      "b.md": "# はじめに\n\n「メンバー」とは、料金を払った人のことです。\n\n月額料金：1,500円\n",
      "c.md": "# 料金\n\n「メンバー」とは、ワークスペースに招かれた人のことです。\n\n月額料金：1,200円\n",
    };
    const cli = await runCli(files, ["a.md", "b.md", "c.md", "--experimental", "--compact"]);
    rmSync(cli.dir, { recursive: true, force: true });
    assert.match(cli.out, /b\.md[\s\S]*3:1 +warning 「メンバー」を、一緒に見たほかの 2 ファイルと違う言葉で定義しています（例：a\.md）/u);
    assert.match(cli.out, /5:6 +warning 「月額料金」が 1,500円 と書かれていますが、一緒に見たほかの 2 ファイルでは 1,200円 です（例：a\.md）/u);
  });
});
