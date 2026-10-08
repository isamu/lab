import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { undefinedCalls } from "../packages/chaff/src/undefined-call.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// ページが説明していない関数をコード例で呼ぶ（undefined-function-call）。例文は自作。

const RULE = "undefined-function-call";
const FENCE = "```";

const found = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("api.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "technical/readme")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.line)} ${String(finding.values["name"])}>${String(finding.values["documented"])}`);

const page = (heading: string, ...code: string[]): string => [`## ${heading}`, "", "Text.", "", `${FENCE}js`, ...code, FENCE, ""].join("\n");

before(async () => prepare());

describe("undefined-function-call", () => {
  it("ja and en: an example calling a longer name than the documented function", () => {
    assert.deepEqual(found(page("wrap", 'const lines = wrapText("text", 10);'), ja), ["6 wrapText>wrap"]);
    assert.deepEqual(found(page("wrap", 'const lines = wrap("text", 10);'), en), []);
    assert.deepEqual(found(page("`wrap()`", 'wrapLines("text", 10);'), en), ["6 wrapLines>wrap"]);
  });

  it("an imported name is documented", () => {
    const source = ["# wrapkit", "", FENCE + "js", 'import { wrap } from "wrapkit";', "", 'console.log(wrapLines("text", 20).join("\\n"));', FENCE, ""].join(
      "\n",
    );
    assert.deepEqual(found(source, en), ["6 wrapLines>wrap"]);
  });

  it("leaves a name defined or written elsewhere, a member call, and other names", () => {
    assert.deepEqual(found(page("wrap", "function wrapAll(texts) { return texts.map(wrap); }", "wrapAll(texts);"), en), []);
    assert.deepEqual(found(page("wrap", "console.log(wrap(text, 10));", "lines.wrapText(10);"), en), []);
    assert.deepEqual(found(page("wrap", "measure(text);"), en), []);
    assert.deepEqual(found(`${page("wrap", "wrapText(text);")}\nSee also \`wrapText\`.\n`, en), []);
  });

  it("a comment in a code block is no heading", () => {
    const source = ["# Setup", "", `${FENCE}python`, "# configure the parser", "configureParser(debug=True)", FENCE, ""].join("\n");
    assert.deepEqual(found(source, en), []);
  });

  it("leaves a declaration, a commented-out call, a type-only import and a language's own function", () => {
    assert.deepEqual(found(page("wrap", "function wrapText(text) { return text.trim(); }"), en), []);
    assert.deepEqual(found(page("configure", "// configureParser({ debug: true })"), en), []);
    const typed = ["# Config", "", `${FENCE}ts`, 'import { type Config } from "pkg";', "", "typeCheck(config);", FENCE, ""].join("\n");
    assert.deepEqual(found(typed, en), []);
    assert.deepEqual(found(page("parse", "const port = parseInt(value, 10);"), en), []);
  });

  it("a short documented name is no stem", () => {
    assert.deepEqual(found(page("get", "getItem(key);"), en), []);
  });
});

describe("undefined-function-call: the pure part", () => {
  it("says nothing on an empty page, a page with no code, or no heading", () => {
    assert.deepEqual(undefinedCalls("", []), []);
    assert.deepEqual(undefinedCalls("## wrap\n\nwrapText(x) is not code.\n", ["wrap"]), []);
    assert.deepEqual(undefinedCalls(`${FENCE}js\nwrapText(x);\n${FENCE}\n`, []), []);
  });

  it("points at the called name", () => {
    const source = page("wrap", "  wrapText(x);");
    const calls = undefinedCalls(source, ["wrap"]);
    assert.deepEqual(
      calls.map((call) => source.slice(call.offset, call.offset + call.name.length)),
      ["wrapText"],
    );
  });
});
