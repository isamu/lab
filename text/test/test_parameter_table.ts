import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { parameterSlips, signatureOf } from "../packages/chaff/src/parameter-table.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// API リファレンスのシグネチャと引数の表の食い違い（parameter-table-mismatch）。例文は自作。

const RULE = "parameter-table-mismatch";
const FENCE = "```";
const HEADERS = new Set(["parameter", "引数"]);

const found = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("api.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "technical/readme")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.line)} ${String(finding.values["name"])}`);

const reference = (signature: string, header: string, ...names: string[]): string =>
  ["## wrap", "", `${FENCE}ts`, signature, FENCE, "", `| ${header} | Type |`, "| --- | --- |", ...names.map((name) => `| \`${name}\` | string |`), ""].join(
    "\n",
  );

const WRAP = "wrap(text: string, width = 72, options?: WrapOptions): string[]";

before(async () => prepare());

describe("parameter-table-mismatch", () => {
  it("ja and en: a row the signature does not take, and a parameter the table leaves out", () => {
    assert.deepEqual(found(reference(WRAP, "引数", "text", "width", "options"), ja), []);
    assert.deepEqual(found(reference(WRAP, "引数", "text", "widht", "options"), ja), ["4 width", "10 widht"]);
    assert.deepEqual(found(reference(WRAP, "Parameter", "text", "width"), en), ["4 options"]);
    assert.deepEqual(found(reference(WRAP, "Parameter", "text", "width", "options", "locale"), en), ["12 locale"]);
  });

  it("Python, Go-like and function declarations; spreads, receivers and fields of an options object", () => {
    assert.deepEqual(found(reference("def wrap(self, text, width=72, *args, **kwargs):", "Parameter", "text", "width", "*args", "**kwargs"), en), []);
    assert.deepEqual(found(reference("export function wrap(text, width = 72) {", "Parameter", "text", "width", "options.prefix"), en), ["11 options"]);
    assert.deepEqual(found(reference("function wrap(text, ...rest) {", "Parameter", "text", "...rest"), en), []);
  });

  it("does not compare a call, a table with another header, or a table after another heading", () => {
    assert.deepEqual(found(reference('wrap("text", 10);', "Parameter", "text", "size"), en), []);
    assert.deepEqual(found(reference(WRAP, "Option", "prefix"), en), []);
    const later = reference(WRAP, "Parameter", "text").replace("| Parameter", "## Options\n\n| Parameter");
    assert.deepEqual(found(later, en), []);
  });

  it("a code block declaring two functions is not compared", () => {
    const two = reference(`${WRAP}\nmeasure(text: string): number`, "Parameter", "text");
    assert.deepEqual(found(two, en), []);
  });
});

describe("parameter-table-mismatch: the pure parts", () => {
  it("reads a declaration's parameters and leaves calls and destructured lists", () => {
    assert.deepEqual(
      signatureOf(WRAP)?.params.map((param) => param.name),
      ["text", "width", "options"],
    );
    assert.deepEqual(
      signatureOf("fn wrap(text: &str, width: usize) -> Vec<String> {")?.params.map((param) => param.name),
      ["text", "width"],
    );
    assert.deepEqual(
      signatureOf("on(event: string, handler: (value: number) => void): void")?.params.map((param) => param.name),
      ["event", "handler"],
    );
    assert.deepEqual(
      signatureOf("on(handler: (value: number) => void, once: boolean): void")?.params.map((param) => param.name),
      ["handler", "once"],
    );
    assert.deepEqual(
      signatureOf("func (c *Client) Fetch(ctx context.Context, url string) error")?.params.map((param) => param.name),
      ["ctx", "url"],
    );
    assert.deepEqual(
      signatureOf("fn push(&mut self, mut value: T) -> usize")?.params.map((param) => param.name),
      ["value"],
    );
    assert.deepEqual(
      signatureOf("export const wrap = async (text: string, width = 72): Promise<string[]> =>")?.params.map((param) => param.name),
      ["text", "width"],
    );
    assert.equal(signatureOf("const lines = wrap(text, 10);"), undefined);
    assert.deepEqual(signatureOf("now(): Date")?.params, []);
    ["wrap(text, 10);", "const lines = wrap(text, 10);", "function wrap({ text, width }) {", "", "wrap"].forEach((line) =>
      assert.equal(signatureOf(line), undefined, line),
    );
  });

  it("the offset of a parameter is where its name is written", () => {
    const line = "def wrap(self, text, *args):";
    const params = signatureOf(line)?.params ?? [];
    assert.deepEqual(
      params.map((param) => line.slice(param.offset, param.offset + param.name.length)),
      ["text", "args"],
    );
  });

  it("says nothing on a document with no code, no table, or no header words", () => {
    assert.deepEqual(parameterSlips("", HEADERS), []);
    assert.deepEqual(parameterSlips("| Parameter |\n| --- |\n| `x` |", HEADERS), []);
    assert.deepEqual(parameterSlips(reference(WRAP, "Parameter", "x"), new Set()), []);
  });
});
