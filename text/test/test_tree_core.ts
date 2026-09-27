import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildStructure } from "../packages/chaff/src/structure/build.ts";
import { toSexp } from "../packages/chaff/src/structure/sexp.ts";
import { linesOf } from "../packages/chaff/src/structure/lines.ts";
import { treeTargets } from "../packages/chaff/src/commands/tree.ts";
import type { Mention, NumberedLine, StructureNode, StructurePatterns } from "../packages/chaff/src/plugin.ts";

/**
 * core が言語を知らないことを、ここで作った最小の言語パッケージで確かめる。
 * 「§N」を条、「- N」を項と読む架空の言語。利用者が lang-zh を書くのと同じ立場。
 */
const SECTION = /^§(?<n>\d+)(?<rest>\D.*|)$/u;
const ITEM = /^- (?<n>\d+) (?<rest>.*)$/u;

const numbered = (line: string): NumberedLine | undefined => {
  const section = SECTION.exec(line)?.groups;
  if (section?.["n"] !== undefined)
    return {
      kind: "article",
      depth: 1,
      number: section["n"],
      absolute: true,
      label: `§${section["n"]}`,
      heading: section["rest"]?.trim() ?? "",
      rest: section["rest"]?.trim() ?? "",
    };
  const item = ITEM.exec(line)?.groups;
  if (item?.["n"] !== undefined) return { kind: "item", depth: 2, number: item["n"], absolute: false, label: item["n"], heading: "", rest: item["rest"] ?? "" };
  return undefined;
};

const references = (text: string): Mention[] =>
  [...text.matchAll(/->§(?<n>\d+)/gu)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    attrs: { target: match.groups?.["n"] ?? "", label: match[0] },
  }));

const toy: StructurePatterns = { numbered, definitions: () => [], references, obligations: () => [], quantities: () => [] };

const treeOf = (source: string, markdown = false): StructureNode => buildStructure({ path: "t.txt", source, language: "xx", markdown }, toy);

const addresses = (node: StructureNode): string[] => [...(node.address === "" ? [] : [node.address]), ...node.children.flatMap(addresses)];

describe("木を作る core", () => {
  it("言語パッケージの読んだ番号だけで入れ子と番地を決める", () => {
    const tree = treeOf(["§1 first", "- 1 a", "- 2 b ->§2", "§2 second"].join("\n"));
    assert.deepEqual(addresses(tree), ["1", "1.1", "1.2", "2"]);
    assert.equal(tree.children[0]?.children[1]?.children[0]?.attrs["target"], "2");
  });

  it("位置と行は \\r\\n でも元の文書を指す", () => {
    const source = "intro\r\n§1 first\r\n- 1 a ->§1\r\n";
    const article = treeOf(source).children[0];
    const reference = article?.children[0]?.children[0];
    assert.ok(article !== undefined && reference !== undefined);
    assert.equal(article.line, 2);
    assert.equal(source.slice(article.span.start, article.span.end), "§1 first\r\n- 1 a ->§1");
    assert.equal(source.slice(reference.span.start, reference.span.end), "->§1");
  });

  it("Markdown のコードの中の番号は読まない", () => {
    assert.deepEqual(addresses(treeOf(["# Guide", "", "```", "§9 not a section", "```", "", "§1 real"].join("\n"), true)), ["h1", "1"]);
  });

  it("番号の無い見出しは並び順で h2.1 のような番地になる", () => {
    assert.deepEqual(addresses(treeOf(["# A", "## B", "## C", "# D", "## E"].join("\n"), true)), ["h1", "h1.1", "h1.2", "h2", "h2.1"]);
  });

  it("本文の「1. 」は箇条書きのまま、見出しの「1. 」と「4.2 」は番号として読む", () => {
    assert.deepEqual(addresses(treeOf(["# Guide", "1. step one", "## 2. Setup", "4.2 Details"].join("\n"), true)), ["h1", "2", "4.2"]);
  });

  it("同じ入力から同じ S 式が出る", () => {
    const source = ["§1 first", "- 1 a ->§1"].join("\n");
    assert.equal(toSexp(treeOf(source)), toSexp(treeOf(source)));
  });
});

describe("S 式", () => {
  it('文字列の \\ と " と改行を逃がし、属性をキーの順に並べる', () => {
    const node: StructureNode = {
      kind: "definition",
      address: "",
      span: { start: 0, end: 1 },
      line: 3,
      attrs: { term: 'say "hi"\\\nnow', b: 2 },
      children: [],
    };
    assert.equal(toSexp(node), '(definition :b 2 :term "say \\"hi\\"\\\\\\nnow" :line 3)');
  });
});

describe("linesOf", () => {
  it("\\r を落とし、位置は元の文字列で数える", () => {
    assert.deepEqual(linesOf("a\r\nbc\nd"), [
      { text: "a", start: 0, number: 1 },
      { text: "bc", start: 3, number: 2 },
      { text: "d", start: 6, number: 3 },
    ]);
  });
});

describe("chaff tree の引数", () => {
  it("--format と --language の値はファイルとして読まない", () => {
    assert.deepEqual(treeTargets(["tree", "a.md", "--format", "sexp", "b.txt", "--language", "ja"]), ["a.md", "b.txt"]);
  });
});
