import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 参照先が無い・番号の抜け・二重定義。誤検出しやすい正常な文書と、誤りのある文書を対にする（spec §23）。

const STRUCTURE_RULES = ["dangling-reference", "numbering-gap", "duplicate-definition"];

const lines = (...rows: string[]): string => rows.join("\n");

type Found = readonly [string, Readonly<Record<string, string | number>>];

const findingsOf = (adapter: LanguageAdapter, source: string, path = "c.txt"): Finding[] =>
  runRules(buildDocument(path, source, adapter), loadRules(adapter.id), {}, true, "business/contract").findings.filter((finding) =>
    STRUCTURE_RULES.includes(finding.rule),
  );

/** offset は位置の確認用で、期待値に書くと読みにくいので外して比べる。 */
const withoutOffset = (values: Finding["values"]): Readonly<Record<string, string | number>> =>
  Object.fromEntries(Object.entries(values).filter(([key]) => key !== "offset"));

const found = (adapter: LanguageAdapter, source: string, path?: string): Found[] =>
  findingsOf(adapter, source, path).map((finding) => [finding.rule, withoutOffset(finding.values)]);

describe("日本語: 誤りの無い文書では何も言わない", () => {
  const cases: readonly (readonly [string, string])[] = [
    [
      "第1項に番号を振らない法令の書き方で、第4条第1項を指す",
      lines("第4条（支払）", "甲は支払う。", "２　乙は受け取る。", "第5条（解除）", "第4条第1項に違反したときは解除できる。"),
    ],
    ["枝番号の条は並びの外", lines("第3条（甲）", "本文", "第3条の2（乙）", "本文", "第4条（丙）", "本文")],
    ["章が変わっても条は続く", lines("第1章 総則", "第1条（目的）", "本文", "第2章 義務", "第2条（義務）", "第1条を守る。")],
    ["番号の無い文書から他の文書を指すのは誤りではない", "詳しくは民法第709条を参照する。"],
    ["一度だけの定義", lines("第1条（定義）", "「本件業務」とは、甲が委託する業務をいう。", "第2条（業務）", "乙は本件業務を行う。")],
    ["号の並び", lines("第1条（業務）", "次の業務を行う。", "一　設計", "二　開発", "三　試験")],
  ];
  cases.forEach(([name, source]) => {
    it(name, () => assert.deepEqual(found(ja, source), []));
  });
});

describe("日本語: 誤りを見つける", () => {
  it("存在しない条への参照", () => {
    assert.deepEqual(found(ja, lines("第1条（目的）", "第12条に定める業務を行う。", "第2条（業務）", "本文")), [
      ["dangling-reference", { label: "第12条", target: "12" }],
    ]);
  });

  it("存在しない項への参照（第2項は番号付きで書かれるので、無ければ無い）", () => {
    assert.deepEqual(found(ja, lines("第1条（支払）", "甲は支払う。", "第2条（解除）", "第1条第2項に違反したとき。")), [
      ["dangling-reference", { label: "第1条第2項", target: "1.2" }],
    ]);
  });

  it("条の番号が飛ぶ", () => {
    assert.deepEqual(found(ja, lines("第1条（目的）", "本文", "第2条（定義）", "本文", "第4条（支払）", "本文")), [
      ["numbering-gap", { previous: "第2条", label: "第4条", expected: 3, found: 4 }],
    ]);
  });

  it("項の番号が重なる", () => {
    assert.deepEqual(found(ja, lines("第1条（支払）", "甲は支払う。", "２　期限は月末とする。", "２　遅延には利息を付す。")), [
      ["numbering-gap", { previous: "２", label: "２", expected: 3, found: 2 }],
    ]);
  });

  it("括弧書きの号が飛ぶ", () => {
    assert.deepEqual(found(ja, lines("第1条（禁止事項）", "（1）法令違反", "（3）迷惑行為")), [
      ["numbering-gap", { previous: "（1）", label: "（3）", expected: 2, found: 3 }],
    ]);
  });

  it("同じ語を二度定義する", () => {
    const source = lines("第1条（定義）", "「成果物」とは、納入物をいう。", "第5条（検収）", "「成果物」とは、検収に合格したものをいう。");
    assert.deepEqual(found(ja, source), [
      ["numbering-gap", { previous: "第1条", label: "第5条", expected: 2, found: 5 }],
      ["duplicate-definition", { term: "成果物", first: 2 }],
    ]);
  });
});

describe("English: nothing to say about a sound document", () => {
  const cases: readonly (readonly [string, string])[] = [
    [
      "sections numbered by chapter, 101 then 201",
      lines("CHAPTER 1 GENERAL", "Section 101 Title", "text", "Section 102 Definitions", "text", "CHAPTER 2 DUTIES", "Section 201 Care", "See Section 102."),
    ],
    ["(h), (i), (j) are letters", lines("Section 1 Terms", "(g) seven", "(h) eight", "(i) nine", "(j) ten")],
    ["(a), (i), (ii), (b)", lines("Section 1 Terms", "(a) one", "(i) sub one", "(ii) sub two", "(b) two")],
    ["a reference into another agreement from a document with no numbering", "As provided in Section 5 of the Master Agreement."],
    ["a reference down to a lettered item", lines("Section 4.2 Payment", "(a) Pay within 30 days.", "Section 4.3 Late fees", "See Section 4.2(a).")],
  ];
  cases.forEach(([name, source]) => {
    it(name, () => assert.deepEqual(found(en, source), []));
  });
});

describe("English: finds the errors", () => {
  it("a reference to a section that is not there", () => {
    assert.deepEqual(found(en, lines("Section 1 Scope", "text", "Section 2 Fees", "As set out in Section 9, fees are due.")), [
      ["dangling-reference", { label: "Section 9", target: "9" }],
    ]);
  });

  it("a lettered item skipped", () => {
    assert.deepEqual(found(en, lines("Section 1 Terms", "(a) one", "(c) three")), [
      ["numbering-gap", { previous: "(a)", label: "(c)", expected: 2, found: 3 }],
    ]);
  });

  it("a roman item skipped", () => {
    assert.deepEqual(found(en, lines("Section 1 Terms", "(a) one", "(i) sub one", "(iii) sub three")), [
      ["numbering-gap", { previous: "(i)", label: "(iii)", expected: 2, found: 3 }],
    ]);
  });

  it("a term defined twice", () => {
    const source = lines('"Services" means consulting.', "Section 1 Scope", '"Services" means consulting and support.');
    assert.deepEqual(found(en, source), [["duplicate-definition", { term: "Services", first: 1 }]]);
  });
});

describe("Markdown: headings carry the numbers", () => {
  it("a dotted section skipped in the headings", () => {
    const source = lines("# 1 Intro", "", "## 1.1 Scope", "", "## 1.3 Terms", "", "See 1.2.");
    assert.deepEqual(found(en, source, "spec.md"), [["numbering-gap", { previous: "1.1", label: "1.3", expected: 2, found: 3 }]]);
  });

  it("does not read a reference inside code", () => {
    assert.deepEqual(found(ja, lines("# 規約", "", "## 第1条（目的）", "", "例として `第99条` と書く。"), "terms.md"), []);
  });
});

describe("a language whose adapter cannot read structure", () => {
  it("skips the structure rules with a reason instead of reporting nothing", () => {
    // structure を持たない adapter。英語の adapter から structure だけを除いて作る。
    const blind: LanguageAdapter = {
      kind: en.kind,
      id: en.id,
      apiVersion: en.apiVersion,
      capabilities: en.capabilities,
      detect: en.detect,
      segment: en.segment,
      lexicons: en.lexicons,
    };
    const result = runRules(buildDocument("c.txt", "Section 1 Scope\nSee Section 9.", blind), loadRules("en"), {}, true, "business/contract");
    assert.deepEqual(
      result.findings.filter((finding) => STRUCTURE_RULES.includes(finding.rule)),
      [],
    );
    const skipped = result.skipped.filter((entry) => STRUCTURE_RULES.includes(entry.rule));
    const byName = (left: string, right: string): number => left.localeCompare(right, "en");
    assert.deepEqual(skipped.map((entry) => entry.rule).sort(byName), [...STRUCTURE_RULES].sort(byName));
    assert.ok(skipped.every((entry) => entry.why.includes("構造を読めない")));
  });

  it("stays off unless experimental rules are on", () => {
    const result = runRules(buildDocument("c.txt", "Section 1 Scope\nSee Section 9.", en), loadRules("en"), {}, false, "business/contract");
    assert.deepEqual(
      result.findings.filter((finding) => STRUCTURE_RULES.includes(finding.rule)),
      [],
    );
  });
});

describe("the sample documents (test/fixtures/structure)", () => {
  const ROOT = fileURLToPath(new URL("./fixtures/structure", import.meta.url));
  const ADAPTERS: Readonly<Record<string, LanguageAdapter>> = { ja, en };
  // 見本の中で本当に誤っているのは英語の契約書の一か所だけ。Section 5.1 を指しているが、その節は無い。
  const EXPECTED: Readonly<Record<string, readonly Found[]>> = {
    "en/contract.txt": [["dangling-reference", { label: "Section 5.1", target: "5.1" }]],
  };
  Object.entries(ADAPTERS).forEach(([language, adapter]) => {
    readdirSync(join(ROOT, language))
      .filter((name) => /\.(?:md|txt)$/u.test(name))
      .forEach((name) => {
        const key = `${language}/${name}`;
        it(key, () => assert.deepEqual(found(adapter, readFileSync(join(ROOT, key), "utf8"), name), EXPECTED[key] ?? []));
      });
  });
});
