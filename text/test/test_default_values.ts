import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { defaultSlips } from "../packages/chaff/src/default-values.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 既定値の食い違い（default-value-mismatch）。例文は自作。

const RULE = "default-value-mismatch";
const FENCE = "```";
const WORDS = { headers: ["default"], phrases: ["defaults to"] };

const found = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("api.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "technical/readme")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.line)} ${String(finding.values["value"])}>${String(finding.values["expected"])}`);

const page = (signature: string, ...text: string[]): string => ["## wrap", "", `${FENCE}ts`, signature, FENCE, "", ...text, ""].join("\n");
const table = (header: string, value: string): string[] => [`| Option | ${header} |`, "| --- | --- |", `| \`width\` | ${value} |`];

before(async () => prepare());

describe("default-value-mismatch", () => {
  it("ja and en: prose against the signature", () => {
    assert.deepEqual(found(page("wrap(text: string, width = 72): string[]", "`width` の既定値は 80 文字です。"), ja), ["7 80>72"]);
    assert.deepEqual(found(page("wrap(text: string, width = 72): string[]", "`width` の既定値は 72 文字です。"), ja), []);
    assert.deepEqual(found(page("def wrap(text, width=72):", "`width` defaults to 80 characters."), en), ["7 80>72"]);
  });

  it("a table against the signature, and prose against a table", () => {
    assert.deepEqual(found(page("wrap(text: string, width = 72): string[]", ...table("Default", "80")), en), ["9 80>72"]);
    assert.deepEqual(found(["# wrapkit", "", "`width` の既定値は 80 です。", "", ...table("既定値", "72"), ""].join("\n"), ja), ["3 80>72"]);
    assert.deepEqual(found(["# wrapkit", "", "`width` defaults to 72.", "", ...table("Default", "72.0"), ""].join("\n"), en), []);
  });

  it("strings and booleans compare as written", () => {
    assert.deepEqual(found(page('fmt(text: string, sep = ", "): string', "`sep` defaults to `;`."), en), ["7 ;>, "]);
    assert.deepEqual(found(page("run(strict = false): void", "`strict` defaults to `false`."), en), []);
    assert.deepEqual(found(page("def parse(strict=False):", "`strict` defaults to `false`."), en), []);
    assert.deepEqual(found(page("def parse(strict=False):", "`strict` defaults to `true`."), en), ["7 true>False"]);
  });

  it("does not read a call's argument, two functions that differ, or two sentences alone", () => {
    assert.deepEqual(found(page("wrap(text, width=40)", "`width` defaults to 72."), en), []);
    assert.deepEqual(found(page("wrap(width = 72): string[]\nfill(width = 80): string", "`width` defaults to 72."), en), []);
    assert.deepEqual(found(["# wrapkit", "", "`width` defaults to 72.", "", "Later, `width` defaults to 80.", ""].join("\n"), en), []);
  });
});

describe("default-value-mismatch: the pure part", () => {
  it("says nothing on an empty page or with no words", () => {
    assert.deepEqual(defaultSlips("", WORDS), []);
    assert.deepEqual(defaultSlips(page("wrap(width = 72): string[]", "`width` defaults to 80."), { headers: [], phrases: [] }), []);
  });

  it("points at the differing statement's name", () => {
    const source = page("wrap(width = 72): string[]", "`width` defaults to 80.");
    const slips = defaultSlips(source, WORDS);
    assert.deepEqual(
      slips.map((slip) => source.slice(slip.offset, slip.offset + slip.name.length)),
      ["width"],
    );
  });
});
