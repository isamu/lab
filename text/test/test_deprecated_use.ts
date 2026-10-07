import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { deprecatedUses } from "../packages/chaff/src/deprecated-use.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 非推奨と書いた名前をコード例で使う（deprecated-option-used）。例文は自作。

const RULE = "deprecated-option-used";
const FENCE = "```";
const WORDS = { words: ["deprecated", "非推奨"], negated: ["not deprecated"] };

const found = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("README.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "technical/readme")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.line)} ${String(finding.values["name"])}`);

const doc = (sentence: string, ...code: string[]): string => ["## Options", "", sentence, "", `${FENCE}js`, ...code, FENCE, ""].join("\n");

before(async () => prepare());

describe("deprecated-option-used", () => {
  it("ja and en: an option called deprecated in a sentence, used as a key", () => {
    assert.deepEqual(found(doc("以前の `indent` オプションは非推奨です。代わりに `prefix` を使ってください。", "wrap(text, 40, { indent: 2 });"), ja), [
      "6 indent",
    ]);
    assert.deepEqual(found(doc("以前の `indent` オプションは非推奨です。代わりに `prefix` を使ってください。", 'wrap(text, 40, { prefix: "  " });'), ja), []);
    assert.deepEqual(found(doc("The older `indent` option is deprecated; use `prefix` instead.", "wrap(text, 40, { indent: 2 });"), en), ["6 indent"]);
    assert.deepEqual(found(doc("`prefix` replaces the deprecated `indent`.", "wrap(text, 40, { indent: 2 });"), en), ["6 indent"]);
    assert.deepEqual(found(doc("`indent` を非推奨にし、`prefix` に置き換えました。", 'wrap(text, 40, { prefix: "  " });'), ja), []);
  });

  it("a table row that says deprecated, and uses as an argument, a flag or a JSON key", () => {
    const table = ["| Option | Default | Description |", "| --- | --- | --- |", "| `indent` | 0 | Deprecated since 3.0.0; use `prefix` |"].join("\n");
    assert.deepEqual(found(doc(table, "wrap(text, indent=2)"), en), ["8 indent"]);
    assert.deepEqual(found(doc(table, "wrapkit --indent 2 notes.txt"), en), ["8 indent"]);
    assert.deepEqual(found(doc(table, '{ "indent": 2 }'), en), ["8 indent"]);
  });

  it("leaves a line that says deprecated itself, a member read, a comparison and a longer name", () => {
    const sentence = "The `indent` option is deprecated.";
    assert.deepEqual(found(doc(sentence, "wrap(text, { indent: 2 }); // deprecated form"), en), []);
    assert.deepEqual(found(doc(sentence, "console.log(options.indent);"), en), []);
    assert.deepEqual(found(doc(sentence, "if (indent == 2) {}"), en), []);
    assert.deepEqual(found(doc(sentence, "wrap(text, { indentFirst: 2, firstindent: 1 });"), en), []);
  });

  it("a name only in prose, or a deprecation word with no code name, marks nothing", () => {
    assert.deepEqual(found(doc("The indent option is deprecated.", "wrap(text, { indent: 2 });"), en), []);
    assert.deepEqual(found(doc("This page is deprecated.", "wrap(text, { indent: 2 });"), en), []);
  });

  it("a negated deprecation marks nothing; a flag named with its dashes is marked", () => {
    assert.deepEqual(found(doc("The `indent` option is not deprecated.", "wrap(text, { indent: 2 });"), en), []);
    assert.deepEqual(found(doc("`indent` は非推奨ではありません。", "wrap(text, { indent: 2 });"), ja), []);
    assert.deepEqual(found(doc("The `--indent` flag is deprecated.", "wrapkit --indent 2 notes.txt"), en), ["6 indent"]);
  });

  it("a block that declares an API documents the name, and does not use it", () => {
    assert.deepEqual(found(doc("The `indent` option is deprecated.", "interface Options {", "  indent: number;", "}"), en), []);
  });

  it("a name a table also lists without calling it deprecated may be the other field of that name", () => {
    const tables = [
      "| Field | Description |",
      "| --- | --- |",
      "| example | Deprecated: use `examples`. |",
      "",
      "| Field | Description |",
      "| --- | --- |",
      "| example | An example of the value. |",
    ].join("\n");
    assert.deepEqual(found(doc(tables, '{ "example": 1 }'), en), []);
    assert.deepEqual(found(doc(tables.split("\n").slice(0, 3).join("\n"), '{ "example": 1 }'), en), ["8 example"]);
  });
});

describe("deprecated-option-used: the pure part", () => {
  it("says nothing with no words, no code, or an empty document", () => {
    assert.deepEqual(deprecatedUses("", WORDS), []);
    assert.deepEqual(deprecatedUses(doc("`indent` is deprecated.", "wrap({ indent: 2 })"), { words: [], negated: [] }), []);
    assert.deepEqual(deprecatedUses("`indent` is deprecated.\n\n{ indent: 2 }\n", WORDS), []);
  });

  it("points at the name in the code line", () => {
    const source = doc("`indent` is deprecated.", "wrap({ indent: 2 })");
    const uses = deprecatedUses(source, WORDS);
    assert.deepEqual(
      uses.map((use) => source.slice(use.offset, use.offset + use.name.length)),
      ["indent"],
    );
  });
});
