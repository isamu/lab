import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { returnTypeClashes, signatureOf, typeMembers, type ReturnWords } from "../packages/chaff/src/return-type.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 一つの関数の戻り値の型を二通りに書いた所（return-type-mismatch）。例文は自作。

const RULE = "return-type-mismatch";

const found = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("api.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "technical/readme")
    .findings.filter((finding) => finding.rule === RULE)
    .map(
      (finding) =>
        `${String(finding.line)} ${String(finding.values["function"])}: ${String(finding.values["stated"])} / ${String(finding.values["signature"])}`,
    );

const page = (signature: string, ...body: string[]): string => ["## measure", "", "```ts", signature, "```", "", ...body, ""].join("\n");

const MEASURE = "measure(text: string, tabSize = 4): number";

const EN_WORDS: ReturnWords = {
  labels: ["Returns"],
  verbs: ["returns"],
  subjects: [],
  kinds: new Map([
    ["string", "string"],
    ["number", "number"],
    ["array", "array"],
  ]),
};

before(async () => prepare());

describe("return-type-mismatch: reported", () => {
  it("ja and en: a sentence names another kind than the signature", () => {
    assert.deepEqual(found(page(MEASURE, 'measure は、幅を "12" のような文字列で返します。'), ja), ["7 measure: 文字列 / number"]);
    assert.deepEqual(found(page(MEASURE, 'measure returns the width as a string such as "12".'), en), ["7 measure: string / number"]);
  });

  it("ja and en: a Returns line under the function's heading", () => {
    assert.deepEqual(found(page("wrap(text: string): string[]", "戻り値：`string`。1行ごとに1要素です。"), ja), ["7 wrap: string / string[]"]);
    assert.deepEqual(found(page("wrap(text: string): string[]", "**Returns:** `string`, one entry per line."), en), ["7 wrap: string / string[]"]);
  });

  it("ja and en: a table with a return column", () => {
    const table = (header: string): string[] => [`| 関数 | ${header} |`, "| --- | --- |", "| `wrap()` | `string` |"];
    assert.deepEqual(found(page("wrap(text: string): string[]", ...table("戻り値")), ja), ["9 wrap: string / string[]"]);
    assert.deepEqual(found(page("wrap(text: string): string[]", ...table("Returns")), en), ["9 wrap: string / string[]"]);
  });

  it("ja and en: a type in code in a sentence", () => {
    assert.deepEqual(found(page(MEASURE, "`measure` は `string` を返します。"), ja), ["7 measure: string / number"]);
    assert.deepEqual(found(page(MEASURE, "`measure()` returns `string`."), en), ["7 measure: string / number"]);
  });

  it("a statement that adds a type the signature does not return, and an export default declaration", () => {
    assert.deepEqual(found(page(MEASURE, "Returns: `number | string`."), en), ["7 measure: number | string / number"]);
    assert.deepEqual(found(page("export default function measure(text: string): number", "Returns: a string."), en), ["7 measure: string / number"]);
  });

  it("two declarations with the same parameters and different return types", () => {
    const source = ["```ts", "wrap(text: string): string[]", "```", "", "```ts", "wrap(text: string): string", "```", ""].join("\n");
    assert.deepEqual(found(source, en), ["6 wrap: string / string[]"]);
  });
});

describe("return-type-mismatch: silent", () => {
  it("ja and en: a statement that matches", () => {
    assert.deepEqual(found(page(MEASURE, "戻り値：`number`。行の幅を桁数で返します。", "measure は、幅を桁数の数値で返します。"), ja), []);
    assert.deepEqual(found(page(MEASURE, "Returns: `number`, the width in columns.", "measure returns the width as a number of columns."), en), []);
  });

  it("ja and en: Array<string> and string[] are one type", () => {
    assert.deepEqual(found(page("wrap(text: string): Array<string>", "戻り値：`string[]`。"), ja), []);
    assert.deepEqual(found(page("wrap(text: string): string[]", "Returns: `Array<string>`."), en), []);
    assert.deepEqual(found(page("wrap(text: string): Array<string>", "wrap returns an array of lines."), en), []);
    assert.deepEqual(typeMembers("Array<Array<string>>"), ["string[][]"]);
    assert.deepEqual(typeMembers("null | Array<string | number>"), ["(string|number)[]", "null"]);
  });

  it("ja and en: two overloads with different parameters", () => {
    const overloads = ["```ts", "parse(text: string): Node", "parse(text: string, many: true): Node[]", "```", ""];
    assert.deepEqual(found([...overloads, "Returns: `Node[]` when many is true."].join("\n"), en), []);
    assert.deepEqual(found([...overloads, "parse は `Node[]` を返します。"].join("\n"), ja), []);
  });

  it("ja and en: another function's statement", () => {
    assert.deepEqual(found(page(MEASURE, "format は文字列を返します。"), ja), []);
    assert.deepEqual(found(page(MEASURE, "format returns a string."), en), []);
  });

  it("ja and en: a type mentioned without saying it is returned", () => {
    assert.deepEqual(found(page(MEASURE, "measure は、文字列を受け取ります。", "text には文字列を渡します。"), ja), []);
    assert.deepEqual(found(page(MEASURE, "measure takes a string.", "Pass a string as text; the result is not a string."), en), []);
  });

  it("ja and en: no readable type, or two kinds at once", () => {
    assert.deepEqual(found(page(MEASURE, "measure は、文字列の配列を返します。", "measure は結果を返します。"), ja), []);
    assert.deepEqual(
      found(page(MEASURE, "measure returns an array of strings.", "measure returns `text` unchanged.", "measure returns `null` when empty."), en),
      [],
    );
  });

  it("the past, and a union stated in part", () => {
    assert.deepEqual(found(page(MEASURE, "measure returned a string before 3.0.", "measure は以前、文字列を返していました。"), en), []);
    assert.deepEqual(found(page(MEASURE, "measure は文字列を返すことはありません。", "measure は文字列を返しません。"), ja), []);
    assert.deepEqual(found(page("measure(text: string): number | null", "Returns: `number`."), en), []);
    assert.deepEqual(found(page("load(path: string): Promise<string>", "load returns a string."), en), []);
  });

  it("a Returns line under a heading with two functions is not assigned", () => {
    const source = ["## Functions", "", "```ts", "wrap(text: string): string[]", "measure(text: string): number", "```", "", "Returns: `string`."].join("\n");
    assert.deepEqual(returnTypeClashes(source, EN_WORDS), []);
  });
});

describe("signatureOf", () => {
  it("reads declarations with a return type and leaves calls alone", () => {
    assert.equal(signatureOf("export function wrap<T>(text: T, width = 72): string[] {")?.returns, "string[]");
    assert.equal(signatureOf("const wrap = async (text: string): Promise<string> => {")?.returns, "Promise<string>");
    assert.equal(signatureOf("def measure(text: str, tab: int = 4) -> int:")?.returns, "int");
    assert.equal(signatureOf('const lines = wrap("text", 10);'), undefined);
    assert.equal(signatureOf("wrap(text, 10);"), undefined);
    assert.equal(signatureOf("if (ready):"), undefined);
  });
});
