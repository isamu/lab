import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { atxHeadingText, headingText } from "../packages/chaff/src/heading-text.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 見出しの末尾の属性（kramdown / pandoc）は読者に見えない。見出しの言葉から外して読む。

describe("headingText", () => {
  const cases: readonly (readonly [string, string])[] = [
    ["ステップ 1 — インストール {#step1}", "ステップ 1 — インストール"],
    ["Install {#install}", "Install"],
    ["Notes {: .note}", "Notes"],
    ["Notes {:#notes .x}", "Notes"],
    ["Setup {#setup .unnumbered}", "Setup"],
    ["Setup{#setup}", "Setup"],
    ["  Setup  {#setup}  ", "Setup"],
    ["{name} の設定", "{name} の設定"],
    ["Use {curly} braces", "Use {curly} braces"],
    ["Map {a: 1}", "Map {a: 1}"],
    ["Plain heading", "Plain heading"],
    ["", ""],
    ["{#only}", ""],
    ["Broken {#id", "Broken {#id"],
  ];
  cases.forEach(([raw, expected]) => {
    it(`${JSON.stringify(raw)} → ${JSON.stringify(expected)}`, () => assert.equal(headingText(raw), expected));
  });
});

describe("atxHeadingText", () => {
  const cases: readonly (readonly [string, string])[] = [
    ["Install ## {#install}", "Install"],
    ["Install ##", "Install"],
    ["Install {#install}", "Install"],
    ["C# basics", "C# basics"],
    ["Issue #12", "Issue #12"],
    ["##", ""],
  ];
  cases.forEach(([content, expected]) => {
    it(`${JSON.stringify(content)} → ${JSON.stringify(expected)}`, () => assert.equal(atxHeadingText(content), expected));
  });
});

describe("closing hashes before the attributes", () => {
  const headings = (source: string): string[] =>
    buildDocument("a.md", source, en)
      .sections.map((section) => section.heading)
      .filter((heading) => heading !== "");

  it("reads `## Install ## {#install}` as Install", () => {
    assert.deepEqual(headings("# Guide\n\n## Install ## {#install}\n\ntext\n"), ["Guide", "Install"]);
  });

  it("keeps a setext heading's trailing hashes, which are its words", () => {
    assert.deepEqual(headings("Price ##\n========\n\ntext\n"), ["Price ##"]);
  });

  it("the tree keeps a setext heading's trailing hashes as well", () => {
    if (en.structure === undefined) throw new Error("no structure");
    const tree = buildStructure(
      { path: "a.md", source: "Guide\n=====\n\nSection 2 Price ##\n-----------------\n\ntext\n", language: "en", markdown: true },
      en.structure,
    );
    const article = tree.children[0]?.children.find((node) => node.kind === "article");
    assert.equal(article?.attrs["heading"], "Price ##");
  });

  it("the tree's numbered heading too", () => {
    if (ja.structure === undefined) throw new Error("no structure");
    const tree = buildStructure(
      { path: "a.md", source: "# 規約\n\n## 第3条（支払） ## {#a3}\n\n甲は支払う。\n", language: "ja", markdown: true },
      ja.structure,
    );
    assert.equal(tree.children[0]?.children.find((node) => node.kind === "article")?.attrs["heading"], "支払");
  });
});

const echoes = (source: string, adapter = ja): number => {
  const doc = buildDocument("a.md", source, adapter);
  return runRules(doc, loadRules(adapter.id), {}, false, "technical/readme").findings.filter((finding) => finding.rule === "heading-echo").length;
};

describe("heading-echo sees through an anchor", () => {
  it("reports the echo under a heading with {#id}, as it does without one", () => {
    const body = "ワークスペースを切り替えます。";
    assert.equal(echoes(`## ワークスペースを切り替える\n\n${body}\n`), 1);
    assert.equal(echoes(`## ワークスペースを切り替える {#switch}\n\n${body}\n`), 1);
  });

  it("in English too", () => {
    const body = "Switch the workspace.";
    assert.equal(echoes(`## Switching the workspace\n\n${body}\n`, en), 1);
    assert.equal(echoes(`## Switching the workspace {#switch}\n\n${body}\n`, en), 1);
  });
});

describe("the tree reads the heading without its attributes", () => {
  it("keeps the article's heading clean and its address unchanged", () => {
    if (ja.structure === undefined) throw new Error("no structure");
    const tree = buildStructure({ path: "a.md", source: "# 規約\n\n## 第3条（支払） {#a3}\n\n甲は支払う。\n", language: "ja", markdown: true }, ja.structure);
    const article = tree.children[0]?.children.find((node) => node.kind === "article");
    assert.equal(article?.address, "3");
    assert.equal(article?.attrs["heading"], "支払");
  });

  it("an unnumbered section's heading", () => {
    if (en.structure === undefined) throw new Error("no structure");
    const tree = buildStructure({ path: "a.md", source: "# Guide\n\n## Install {#install}\n\ntext\n", language: "en", markdown: true }, en.structure);
    assert.equal(tree.children[0]?.children[0]?.attrs["heading"], "Install");
  });
});
