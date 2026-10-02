import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import { duplicateDefinitions } from "../packages/chaff/src/structure/issues.ts";
import { readsOnHeading } from "../packages/chaff/src/structure/heading-leaves.ts";
import type { LanguageAdapter, StructureKind, StructureNode, StructurePatterns } from "../packages/chaff/src/plugin.ts";

// 見出しは節の題で、「『X』とは」を掲げても定義ではない。定義は本文の文が言う。例文は自作。

const lines = (...rows: string[]): string => rows.join("\n");

const patternsOf = (adapter: LanguageAdapter): StructurePatterns => {
  if (adapter.structure === undefined) throw new Error(`${adapter.id} has no structure`);
  return adapter.structure;
};

const treeOf = (adapter: LanguageAdapter, source: string, markdown = true): StructureNode =>
  buildStructure({ path: markdown ? "c.md" : "c.txt", source, language: adapter.id, markdown }, patternsOf(adapter));

const duplicates = (adapter: LanguageAdapter, source: string, markdown = true): string[] =>
  duplicateDefinitions(treeOf(adapter, source, markdown)).map((issue) => String(issue.values["term"]));

const kindsIn = (node: StructureNode): StructureKind[] => [node.kind, ...node.children.flatMap(kindsIn)];

const ALL_KINDS: readonly StructureKind[] = ["doc", "section", "chapter", "article", "item", "definition", "reference", "obligation", "quantity", "date"];

describe("readsOnHeading", () => {
  it("定義だけは見出しから拾わない", () => {
    assert.deepEqual(
      ALL_KINDS.filter((kind) => !readsOnHeading(kind)),
      ["definition"],
    );
  });
});

describe("duplicate-definition と見出し", () => {
  it("valid: 「『X』とは」の見出しの下で本文が定義するのは、一度の定義", () => {
    const source = lines("# 警報", "", "## 「特別警報」とは", "", "「特別警報」とは、基準をはるかに超える現象が予想されるときに出す警報です。");
    assert.deepEqual(duplicates(ja, source), []);
  });

  it("valid: 見出しの「『X』とは」は、それだけでは定義として木に入らない", () => {
    assert.ok(!kindsIn(treeOf(ja, lines("## 「特別警報」とは", "", "警報より重い知らせです。"))).includes("definition"));
  });

  it("invalid: 本文で同じ語を二度定義すれば、見出しがあっても重なり", () => {
    const source = lines(
      "## 「特別警報」とは",
      "",
      "「特別警報」とは、基準をはるかに超える現象のときに出す警報です。",
      "",
      "## 補足",
      "",
      "「特別警報」とは、数十年に一度の現象のときに出す警報です。",
    );
    assert.deepEqual(duplicates(ja, source), ["特別警報"]);
  });

  it("valid: 見出しの参照は、これまでどおり木に入る", () => {
    assert.ok(kindsIn(treeOf(ja, lines("## 第3条の読み方", "", "本文です。"))).includes("reference"));
  });

  it("invalid: テキストの文書（見出しの無い条文）は、これまでどおり二度目の定義を指摘する", () => {
    assert.deepEqual(duplicates(ja, lines("第一条　「本件業務」とは、設計をいう。", "第二条　「本件業務」とは、開発をいう。"), false), ["本件業務"]);
  });

  it("valid: English — a heading that names the term is not its definition", () => {
    const source = lines("## “Controller” means", "", "“Controller” means the person who decides the purposes of processing.");
    assert.deepEqual(duplicates(en, source), []);
  });

  it("invalid: English — two definitions in the body are still reported", () => {
    const source = lines("## Terms", "", "“Controller” means the person who decides.", "", "“Controller” means the body that decides.");
    assert.deepEqual(duplicates(en, source), ["Controller"]);
  });
});

describe("duplicate-definition と、1 つのページに載せた 2 つの文書", () => {
  const instrument = (heading: string, first: number): string[] => [
    `## ${heading}`,
    "",
    `第${String(first)}条\u3000本規約（以下「本規約」という。）は、市（以下「市」という。）が提供するアプリ（以下「本アプリ」という。）について定める。`,
    "",
    `第${String(first + 1)}条\u3000利用者は、本アプリを使うことができる。`,
    "",
  ];

  it("valid: 条の番号を第1条からやり直す見出しごとに、同じ語を定義し直してよい（利用規約と個人情報保護方針）", () => {
    const source = lines("# サービス利用規約", "", ...instrument("アプリ利用規約", 1), ...instrument("個人情報保護方針", 1));
    assert.deepEqual(duplicates(ja, source), []);
  });

  it("valid: 条の中に限った定義も、文書ごとの同じ番号の条で別々に定義してよい", () => {
    const local = (heading: string): string[] => [`## ${heading}`, "", "第1条　この条において「利用者」とは、アプリを使う者をいう。", ""];
    assert.deepEqual(duplicates(ja, lines("# サービス利用規約", "", ...local("アプリ利用規約"), ...local("個人情報保護方針"))), []);
  });

  it("invalid: 1 つの文書の中で二度定義すれば、これまでどおり指摘する", () => {
    const source = lines("# サービス利用規約", "", ...instrument("アプリ利用規約", 1), ...instrument("個人情報保護方針", 1), "第3条　「市」とは、県をいう。");
    assert.deepEqual(duplicates(ja, source), ["市"]);
  });

  it("invalid: 番号が続く見出し（第3条から）は同じ文書の続きなので、定義し直せば指摘する", () => {
    const source = lines("# サービス利用規約", "", ...instrument("総則", 1), ...instrument("利用", 3));
    assert.deepEqual(duplicates(ja, source), ["本規約", "市", "本アプリ"]);
  });

  it("invalid: 第1条から始まる見出しが 1 つだけなら文書は 1 つで、見出しの外の定義とも比べる", () => {
    const source = lines("# サービス利用規約", "", "「市」とは、この規約を定めた市をいう。", "", ...instrument("アプリ利用規約", 1));
    assert.deepEqual(duplicates(ja, source), ["市"]);
  });
});
