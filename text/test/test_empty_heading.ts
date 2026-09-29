import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasTitle } from "../packages/chaff/src/heading-title.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import type { LanguageAdapter, StructureNode } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 題の無い見出し（`###` だけ、記号だけ）は区切りであって節の始まりではない。見出しとして数えない。

describe("hasTitle", () => {
  const untitled = ["", " ", "---", "** **", "※", "・・・", "***", "—", "🚀", "()", "#"];
  const titled = ["Scope", "本題", "2", "第1条", "a", "Q&A", "C#", "（目的）", "Ⅳ", "é"];
  untitled.forEach((text) => {
    it(`${JSON.stringify(text)} has no title`, () => assert.equal(hasTitle(text), false));
  });
  titled.forEach((text) => {
    it(`${JSON.stringify(text)} has a title`, () => assert.equal(hasTitle(text), true));
  });
});

const sectionsOf = (source: string, adapter: LanguageAdapter = en): { depth: number; heading: string; sentences: number }[] =>
  buildDocument("a.md", source, adapter).sections.map((section) => ({ depth: section.depth, heading: section.heading, sentences: section.sentences.length }));

describe("an untitled heading is not a section boundary", () => {
  const cases: readonly (readonly [string, string])[] = [
    ["an empty ATX heading", "###"],
    ["an empty ATX heading with trailing spaces", "###   "],
    ["a lone #", "#"],
    ["only closing hashes", "## ##"],
    ["only marks", "## ---"],
    ["only emphasis markers", "### ** **"],
    ["only an attribute", "## {#anchor}"],
    ["only a Japanese mark", "## ※"],
    ["only an image", "## ![](logo.png)"],
  ];
  cases.forEach(([name, line]) => {
    it(`${name}: the text on both sides stays in one section`, () => {
      assert.deepEqual(sectionsOf(`# Title\n\nBefore it.\n\n${line}\n\nAfter it.\n`), [{ depth: 1, heading: "Title", sentences: 2 }]);
    });
  });

  it("a setext heading of only marks", () => {
    assert.deepEqual(sectionsOf("# Title\n\nBefore it.\n\n...\n---\n\nAfter it.\n"), [{ depth: 1, heading: "Title", sentences: 2 }]);
  });

  it("titled headings at every depth stay, with their depths", () => {
    const source = "# One\n\nA.\n\n## Two\n\nB.\n\n### Three\n\nC.\n\n#### 4\n\nD.\n\n##### 第5条\n\nE.\n";
    assert.deepEqual(
      sectionsOf(source).map((section) => [section.depth, section.heading]),
      [
        [1, "One"],
        [2, "Two"],
        [3, "Three"],
        [4, "4"],
        [5, "第5条"],
      ],
    );
  });

  it("an untitled heading between titled ones joins the section before it", () => {
    const source = "# One\n\nA.\n\n## Two\n\nB.\n\n###\n\nC.\n\n## Three\n\nD.\n";
    assert.deepEqual(sectionsOf(source), [
      { depth: 1, heading: "One", sentences: 1 },
      { depth: 2, heading: "Two", sentences: 2 },
      { depth: 2, heading: "Three", sentences: 1 },
    ]);
  });

  it("Japanese: 記号だけの見出しは前の節に続く", () => {
    assert.deepEqual(sectionsOf("# 表題\n\n前です。\n\n## ・・・\n\n後です。\n", ja), [{ depth: 1, heading: "表題", sentences: 2 }]);
  });

  it("a document of only untitled headings has one untitled section", () => {
    assert.deepEqual(sectionsOf("###\n\nText.\n\n## ---\n\nMore.\n"), [{ depth: 0, heading: "", sentences: 2 }]);
  });

  it("an empty document has no sections, with or without an empty heading", () => {
    assert.deepEqual(sectionsOf(""), []);
    assert.deepEqual(sectionsOf("###\n"), [{ depth: 0, heading: "", sentences: 0 }]);
  });
});

const preamble = (source: string, adapter: LanguageAdapter): number =>
  runRules(buildDocument("a.md", source, adapter), loadRules(adapter.id), {}, true, "business/report").findings.filter(
    (finding) => finding.rule === "preamble-length",
  ).length;

describe("preamble-length does not start the body at an untitled heading", () => {
  const paragraphs = "First.\n\nSecond.\n\nThird.\n\nFourth.\n\n";

  it("English: a release whose only deeper heading is empty has no subheading, so no preamble", () => {
    assert.equal(preamble(`# Release\n\n${paragraphs}###\n\nAbout us.\n`, en), 0);
  });

  it("English: the same paragraphs before a titled subheading are still preamble", () => {
    assert.equal(preamble(`# Release\n\n${paragraphs}## Details\n\nAbout us.\n`, en), 1);
  });

  it("English: an empty heading before the titled one does not end the preamble early", () => {
    assert.equal(preamble(`# Release\n\nFirst.\n\n###\n\n${paragraphs}## Details\n\nBody.\n`, en), 1);
  });

  it("日本語: 空の見出しだけなら中見出しの無い文書として何も言わない", () => {
    assert.equal(preamble("# 表題\n\n一。\n\n二。\n\n三。\n\n###\n\n会社概要。\n", ja), 0);
  });

  it("日本語: 題のある中見出しなら従来どおり指摘する", () => {
    assert.equal(preamble("# 表題\n\n一。\n\n二。\n\n三。\n\n## 本題\n\n中身。\n", ja), 1);
  });
});

const headingsIn = (node: StructureNode): string[] => [
  ...(node.kind === "section" ? [String(node.attrs["heading"])] : []),
  ...node.children.flatMap(headingsIn),
];

describe("the tree has no untitled section", () => {
  it("an empty heading opens no node, and the next heading takes the next address", () => {
    if (en.structure === undefined) throw new Error("no structure");
    const tree = buildStructure(
      { path: "a.md", source: "# Rules\n\n## Scope\n\nBody.\n\n###\n\nMore.\n\n### Detail\n\nText.\n", language: "en", markdown: true },
      en.structure,
    );
    assert.deepEqual(headingsIn(tree), ["Rules", "Scope", "Detail"]);
    const detail = tree.children[0]?.children[0]?.children[0];
    assert.equal(detail?.address, "h1.1.1");
  });

  it("the line of an untitled heading adds no leaf to the section it falls in", () => {
    const patterns = ja.structure;
    if (patterns === undefined) throw new Error("no structure");
    const kinds = (node: StructureNode): string[] => [node.kind, ...node.children.flatMap(kinds)];
    ["###", "## ---", "## ※", "## {#a3}"].forEach((line) => {
      const tree = buildStructure({ path: "a.md", source: `# 規約\n\n## 目的\n\n本文。\n\n${line}\n\n付記。\n`, language: "ja", markdown: true }, patterns);
      assert.deepEqual(kinds(tree), ["doc", "section", "section"], line);
    });
  });
});
