import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { outlineOf, type Outline } from "../packages/chaff/src/outline/shape.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { runCli } from "./cli-run.ts";

// chaff outline: a document's headings and shape, measured so a restructure shows as numbers. Every text here is written for the test.

const lines = (...rows: string[]): string => rows.join("\n");

const outline = (adapter: LanguageAdapter, source: string, path = "a.md"): Outline => outlineOf(buildDocument(path, source, adapter));

const LISTY = lines(
  "# 在庫の棚卸し",
  "",
  "## やること",
  "",
  "棚卸しは**月末**に行います。",
  "",
  "- 倉庫の棚を数えます。",
  "- 帳簿と照らします。",
  "",
  "## 結果",
  "",
  "差は**二件**でした。**どちらも**入力の誤りでした。",
);

const NARRATIVE = lines("# 月末の棚卸しで差が二件見つかった", "", "月末に倉庫の棚を数え、帳簿と照らしました。差は二件で、どちらも入力の誤りでした。");

describe("the outline of a document", () => {
  it("lists each heading with its depth, line and own length, and measures the shape", () => {
    const measured = outline(ja, LISTY);
    assert.equal(measured.unit, "char");
    assert.deepEqual(
      measured.entries.map((entry) => [entry.depth, entry.heading, entry.line]),
      [
        [1, "在庫の棚卸し", 1],
        [2, "やること", 3],
        [2, "結果", 10],
      ],
    );
    assert.equal(measured.entries[0]?.length, 0);
    assert.ok((measured.entries[1]?.length ?? 0) > 0);
    assert.equal(measured.shape.headings, 3);
    assert.equal(measured.shape.bold, 3);
    assert.ok(measured.shape.listPercent > 0 && measured.shape.listPercent < 100, String(measured.shape.listPercent));
  });

  it("averages only the sections that have text, so a title line alone does not halve it", () => {
    const measured = outline(ja, LISTY);
    const withText = measured.entries.map((entry) => entry.length).filter((length) => length > 0);
    assert.equal(withText.length, 2);
    assert.equal(measured.shape.averageSectionLength, Math.round((withText[0] ?? 0) / 2 + (withText[1] ?? 0) / 2));
  });

  it("a narrative has fewer headings, no lists and no bold", () => {
    const measured = outline(ja, NARRATIVE);
    assert.deepEqual(measured.shape, { headings: 1, averageSectionLength: measured.entries[0]?.length ?? -1, listPercent: 0, bold: 0 });
  });

  it("all text in lists is 100%", () => {
    assert.equal(outline(ja, lines("- 一つ目の項目です。", "- 二つ目の項目です。")).shape.listPercent, 100);
  });

  it("lists the text before the first heading only when there is some", () => {
    const withLead = outline(ja, lines("前置きの文です。", "", "## 本題", "", "本題の文です。"));
    assert.deepEqual(
      withLead.entries.map((entry) => entry.depth),
      [0, 2],
    );
    assert.equal(withLead.shape.headings, 1);
    const titleOnly = outline(ja, lines("# 題", "", "## 本題", "", "本題の文です。"));
    assert.ok(titleOnly.entries.every((entry) => entry.depth > 0));
    // A blog's front matter sits above the first heading too, and is not text of the article.
    const frontMatter = outline(ja, lines("---", "title: 題", "---", "", "## 本題", "", "本題の文です。"));
    assert.deepEqual(
      frontMatter.entries.map((entry) => entry.depth),
      [2],
    );
  });

  it("counts English in words", () => {
    const measured = outline(en, lines("# Notes", "", "We met on Tuesday and agreed on the plan."));
    assert.equal(measured.unit, "word");
    assert.equal(measured.entries[0]?.length, 9);
  });

  it("an empty document has no entries and zeros everywhere", () => {
    assert.deepEqual(outline(ja, ""), { unit: "char", entries: [], shape: { headings: 0, averageSectionLength: 0, listPercent: 0, bold: 0 } });
  });
});

type ShapeJson = { readonly path: string; readonly language: string; readonly shape: { readonly headings: number; readonly bold: number } };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isShapeJson = (value: unknown): value is ShapeJson => isRecord(value) && typeof value["path"] === "string" && isRecord(value["shape"]);

describe("chaff outline on the command line", () => {
  const files = { "before.md": LISTY, "after.md": NARRATIVE };

  it("shows one file's shape and outline, indented by depth, with the line and length", async () => {
    const run = await runCli(files, ["outline", "before.md"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    assert.match(
      run.out,
      /^before\.md の構成: 見出し 3、節の平均 \d+ 字、箇条書き \d+%、太字 3\n\n {2}# 在庫の棚卸し {2}\(before\.md:1\) {2}0 字\n {4}## やること {2}\(before\.md:3\) {2}\d+ 字/u,
    );
    assert.doesNotMatch(run.out, /構成の変化/u);
  });

  it("puts two files side by side and says how each measure moved", async () => {
    const run = await runCli(files, ["outline", "before.md", "after.md"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /\nafter\.md の構成: 見出し 1、/u);
    assert.match(
      run.out,
      /\n構成の変化（before\.md → after\.md）\n {2}見出し: 3 → 1\n {2}節の平均: \d+ 字 → \d+ 字\n {2}箇条書き: \d+% → 0%\n {2}太字: 3 → 0$/u,
    );
  });

  it("speaks English for an English document", async () => {
    const run = await runCli(
      { "a.md": lines("Before any heading, a line.", "", "## Notes", "", "We met on **Tuesday**.") },
      ["outline", "a.md"],
      "ja_JP.UTF-8",
    );
    assert.equal(run.code, 0, run.err);
    assert.match(
      run.out,
      /^a\.md outline: headings 1, average section \d+ words, in lists 0%, bold 1\n\n {2}\(before the first heading\) {2}\(a\.md:1\) {2}5 words\n {4}## Notes {2}\(a\.md:3\) {2}5 words$/u,
    );
  });

  it("--compact gives one section per line, then each file's shape", async () => {
    const run = await runCli(files, ["outline", "before.md", "after.md", "--compact"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    const rows = run.out.split("\n");
    assert.equal(rows[0], "before.md:1: h1 在庫の棚卸し (0 chars)");
    assert.match(rows[1] ?? "", /^before\.md:3: h2 やること \(\d+ chars\)$/u);
    assert.match(rows.at(-2) ?? "", /^before\.md の構成: /u);
    assert.match(rows.at(-1) ?? "", /^after\.md の構成: /u);
  });

  it("--json gives one file as an object and two as before and after, and wins over --compact", async () => {
    const one: unknown = JSON.parse((await runCli(files, ["outline", "before.md", "--json", "--compact"], "en_US.UTF-8")).out);
    assert.ok(isShapeJson(one));
    assert.equal(one.shape.headings, 3);
    assert.equal(one.language, "ja");
    const two: unknown = JSON.parse((await runCli(files, ["outline", "before.md", "after.md", "--json"], "en_US.UTF-8")).out);
    assert.ok(isRecord(two) && isShapeJson(two["before"]) && isShapeJson(two["after"]));
    assert.equal(two["after"].shape.bold, 0);
  });

  it("reads the value of --language and --genre as a value, not a file", async () => {
    const run = await runCli(files, ["outline", "--genre", "blog/tech", "before.md", "--language", "ja"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /^before\.md の構成/u);
  });

  it("takes one or two files: none or three is a usage error, in the host's language", async () => {
    const none = await runCli(files, ["outline"], "en_US.UTF-8");
    assert.equal(none.code, 1);
    assert.match(none.err, /^usage: chaff outline <file> \[<rewritten>\]/u);
    const three = await runCli(files, ["outline", "before.md", "after.md", "before.md"], "ja_JP.UTF-8");
    assert.equal(three.code, 1);
    assert.match(three.err, /^使い方: chaff outline/u);
  });

  it("ends with 1 when either file cannot be read, and prints no outline", async () => {
    const run = await runCli(files, ["outline", "before.md", "missing.md"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /missing\.md/u);
    assert.equal(run.out, "");
    const first = await runCli(files, ["outline", "missing.md", "after.md"], "en_US.UTF-8");
    assert.equal(first.code, 1);
    assert.equal(first.err.split("\n").length, 1, first.err);
    assert.equal(first.out, "");
  });
});
