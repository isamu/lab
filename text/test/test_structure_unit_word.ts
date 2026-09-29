import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { namesAbsentUnit } from "../packages/chaff/src/structure/unit-word.ts";
import type { LanguageAdapter, StructureNode } from "../packages/chaff/src/plugin.ts";

// 見出しに「1 目的」と番号を振った文書の「法第2条」は、その文書の 2 ではなく法律の条。例文はすべて自作。

const reference = (attrs: Readonly<Record<string, string | number>>): StructureNode => ({
  kind: "reference",
  address: "",
  span: { start: 0, end: 0 },
  line: 1,
  attrs: { label: "第2条", target: "2", ...attrs },
  children: [],
});

describe("namesAbsentUnit: 参照の単位の語が、文書の条の番号に一つも無いか", () => {
  const cases: readonly (readonly [string, Readonly<Record<string, string | number>>, readonly string[], boolean])[] = [
    ["条が見出しの番号（1、2）だけの文書", { unitWord: "条" }, ["1", "2"], true],
    ["条が一つも無い文書", { unitWord: "条" }, [], true],
    ["「第1条」と書いた条がある文書", { unitWord: "条" }, ["1", "第1条"], false],
    ["漢数字の条（第一条）", { unitWord: "条" }, ["第一条"], false],
    ["枝番号の条（第3条の2）だけでも条がある", { unitWord: "条" }, ["第3条の2"], false],
    ["単位の語の無い参照（英語の Section）は決めない", {}, ["1", "2"], false],
    ["単位の語が空なら決めない", { unitWord: "" }, ["1"], false],
    ["単位の語が空なら、条の無い文書でも決めない", { unitWord: "" }, [], false],
    ["単位の語が文字列でなければ決めない", { unitWord: 1 }, ["1"], false],
  ];
  cases.forEach(([name, attrs, labels, expected]) => {
    it(name, () => assert.equal(namesAbsentUnit(reference(attrs), labels), expected));
  });
});

const dangling = (adapter: LanguageAdapter, source: string, path: string): string[] =>
  runRules(buildDocument(path, source, adapter), loadRules(adapter.id), {}, true, "business/report")
    .findings.filter((finding) => finding.rule === "dangling-reference")
    .map((finding) => String(finding.values["label"]));

const lines = (...rows: string[]): string => rows.join("\n");

describe("dangling-reference: 番号の見出しで組んだ文書の「第N条」", () => {
  const guideline = (sentence: string): string => lines("# 指針", "", "## 1 目的", "", "本指針は、法第4条に基づき定める。", "", "## 2 定義", "", sentence, "");

  it("見出しの番号しか無い指針の「法第17条」「第18条」は、指針の中を探さない", () => {
    assert.deepEqual(dangling(ja, guideline("利用目的（法第17条・第18条関係）を定める。"), "guideline.md"), []);
  });

  it("「第N条」と書いた条のある文書では、無い条への参照をこれまでどおり指摘する", () => {
    const rules = lines("# 規程", "", "## 第1条（目的）", "", "本文", "", "## 第2条（定義）", "", "第9条に定める。", "");
    assert.deepEqual(dangling(ja, rules, "rules.md"), ["第9条"]);
  });

  it("見出しの番号と「第N条」の条が混ざる文書でも、無い条は指摘する", () => {
    const mixed = lines("# 規程", "", "## 1 総則", "", "### 第1条（目的）", "", "第9条に定める。", "");
    assert.deepEqual(dangling(ja, mixed, "mixed.md"), ["第9条"]);
  });

  it("英語の Section は単位の語を持たないので、見出しの番号で組んだ文書でもこれまでどおり", () => {
    const spec = lines("# Spec", "", "## 1. Scope", "", "Text.", "", "## 2. Terms", "", "See Section 9.", "");
    assert.deepEqual(dangling(en, spec, "spec.md"), ["Section 9"]);
  });
});
