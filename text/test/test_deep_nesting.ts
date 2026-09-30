import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./cli-run.ts";
import { eachPreOrder, foldPostOrder } from "../packages/chaff/src/tree-walk.ts";
import { inPageAnchors, isInPageNavigation, isNavigationList, type NavNode } from "../packages/chaff/src/in-page-nav.ts";
import { buildTree, NO_OUTLINE } from "../packages/chaff/src/structure/build.ts";
import { resolveRelative } from "../packages/chaff/src/structure/relative-resolve.ts";
import { toSexp } from "../packages/chaff/src/structure/sexp.ts";
import { citedNamesOf } from "../packages/chaff/src/detectors/cited-name.ts";
import { evidenceSpans } from "../packages/chaff/src/detectors/concrete-evidence.ts";
import { numberedStarts } from "../packages/chaff/src/detectors/enumerated-runs.ts";
import type { NumberedLine, StructureNode, StructurePatterns } from "../packages/chaff/src/plugin.ts";

// A document nested far deeper than any real one must still be read: a blockquote or list thousands of levels deep,
// or a language package whose numbering nests without end. Every walk over the trees is iterative, so none overflows the stack.

/** Deeper than the call stack holds for a recursive walk of one frame per level. */
const DEEP = 100_000;

type Tree = { readonly id: number; readonly children?: readonly Tree[] };

const chain = (depth: number): Tree => {
  const holder: { node: Tree } = { node: { id: depth } };
  Array.from({ length: depth }, (_, index) => depth - 1 - index).forEach((id) => {
    holder.node = { id, children: [holder.node] };
  });
  return holder.node;
};

describe("eachPreOrder: a node, then its children from the left", () => {
  it("visits in the same order as a recursive walk", () => {
    const tree: Tree = { id: 0, children: [{ id: 1, children: [{ id: 2 }, { id: 3 }] }, { id: 4 }, { id: 5, children: [{ id: 6 }] }] };
    const seen: number[] = [];
    eachPreOrder(tree, (node) => seen.push(node.id));
    assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 6]);
  });

  it("a node without children, and an empty children list", () => {
    const seen: number[] = [];
    const leaves: readonly Tree[] = [{ id: 7, children: [] }, { id: 8 }];
    leaves.forEach((leaf) => eachPreOrder(leaf, (node) => seen.push(node.id)));
    assert.deepEqual(seen, [7, 8]);
  });

  it(`walks a chain ${String(DEEP)} deep`, () => {
    const seen = { count: 0, last: -1 };
    eachPreOrder(chain(DEEP), (node) => {
      seen.count += 1;
      seen.last = node.id;
    });
    assert.deepEqual(seen, { count: DEEP + 1, last: DEEP });
  });
});

describe("foldPostOrder: children first, from the left, then the node with their results", () => {
  it("combines in post-order with each node's depth", () => {
    const tree: Tree = { id: 0, children: [{ id: 1, children: [{ id: 2 }, { id: 3 }] }, { id: 4 }] };
    const order: string[] = [];
    const text = foldPostOrder(
      tree,
      (node) => node.children ?? [],
      (node, children: readonly string[], depth) => {
        order.push(`${String(node.id)}@${String(depth)}`);
        return `${String(node.id)}(${children.join(",")})`;
      },
    );
    assert.equal(text, "0(1(2(),3()),4())");
    assert.deepEqual(order, ["2@2", "3@2", "1@1", "4@1", "0@0"]);
  });

  it(`folds a chain ${String(DEEP)} deep`, () => {
    const depth = foldPostOrder(
      chain(DEEP),
      (node) => node.children ?? [],
      (_node, children: readonly number[]) => (children[0] ?? -1) + 1,
    );
    assert.equal(depth, DEEP);
  });
});

/** A list nested `depth` levels, each item holding the next list; the innermost item is an in-page link. */
const navChain = (depth: number, innermost: NavNode): NavNode => {
  const holder: { node: NavNode } = { node: innermost };
  Array.from({ length: depth }).forEach(() => {
    holder.node = { type: "list", children: [{ type: "listItem", children: [holder.node] }] };
  });
  return holder.node;
};

const LINK_PARAGRAPH: NavNode = { type: "paragraph", children: [{ type: "link", url: "#top", children: [{ type: "text", value: "top" }] }] };

describe("in-page navigation on a tree nested far too deep", () => {
  it("finds the anchor defined at the bottom", () => {
    const root = navChain(DEEP, { type: "definition", identifier: "toc", url: "#toc" });
    assert.deepEqual([...inPageAnchors(root)], ["toc"]);
  });

  it("a nested list of in-page links is navigation, and one word at the bottom makes it prose", () => {
    assert.equal(isNavigationList(navChain(DEEP, LINK_PARAGRAPH)), true);
    const worded: NavNode = { type: "paragraph", children: [{ type: "text", value: "see" }, ...(LINK_PARAGRAPH.children ?? [])] };
    assert.equal(isNavigationList(navChain(DEEP, worded)), false);
  });

  it("a link inside emphasis nested far too deep", () => {
    const holder: { node: NavNode } = { node: { type: "link", url: "#top", children: [] } };
    Array.from({ length: DEEP }).forEach(() => {
      holder.node = { type: "emphasis", children: [holder.node] };
    });
    assert.equal(isInPageNavigation({ type: "paragraph", children: [holder.node] }), true);
  });
});

/** A language package whose every line opens one level deeper than the last. Nothing in chaff bounds a package's depth. */
const stairs: StructurePatterns = {
  numbered: (line, context): NumberedLine | undefined => {
    const [marker, number, ...rest] = line.split(" ");
    if (marker !== ">" || number === undefined) return undefined;
    return { kind: "item", depth: context.open.length + 1, number, absolute: true, label: number, heading: "", rest: rest.join(" "), ordinal: 1 };
  },
  definitions: () => [],
  references: (text) => (text === "ref" ? [{ start: 0, end: 3, attrs: { target: "1", label: "ref", document: "Act" } }] : []),
  obligations: () => [],
  quantities: () => [],
};

/** Fewer levels than DEEP: buildTree reads the open levels on every line, so a tree this deep already costs a second. */
const STAIR_DEPTH = 12_000;

const stairTree = (): StructureNode => {
  const source = Array.from({ length: STAIR_DEPTH }, (_, index) => `> ${String(index + 1)} ref`).join("\n\n");
  return buildTree({ path: "stairs.txt", source, language: "xx", outline: NO_OUTLINE, markdown: false }, stairs);
};

describe(`a structure tree ${String(STAIR_DEPTH)} levels deep`, () => {
  const tree = stairTree();

  it("is built, printed and read by the detectors", () => {
    const sexp = toSexp(tree);
    assert.equal(sexp.split("\n").length, 1 + 2 * STAIR_DEPTH);
    assert.equal(citedNamesOf(tree).size, STAIR_DEPTH);
    assert.equal(evidenceSpans(tree).length, STAIR_DEPTH);
    assert.equal(numberedStarts(tree).length, STAIR_DEPTH);
  });

  it("numberedStarts leaves out an item anywhere below an article, in document order", () => {
    const node = (kind: StructureNode["kind"], start: number, children: readonly StructureNode[] = []): StructureNode => ({
      kind,
      address: "",
      span: { start, end: start + 1 },
      line: 1,
      attrs: { label: String(start) },
      children,
    });
    const doc = node("doc", 0, [node("item", 1, [node("item", 2)]), node("article", 3, [node("item", 4, [node("item", 5)])]), node("item", 6)]);
    assert.deepEqual(
      numberedStarts(doc).map((found) => found.start),
      [1, 2, 6],
    );
  });

  it("resolves relative references inside it", () => {
    const relative: StructureNode = {
      kind: "reference",
      address: "",
      span: { start: 0, end: 1 },
      line: 1,
      attrs: { relative: "same", level: 1, label: "同条" },
      children: [],
    };
    const holder: { node: StructureNode } = { node: relative };
    Array.from({ length: DEEP }).forEach(() => {
      holder.node = { kind: "section", address: "", span: { start: 0, end: 1 }, line: 1, attrs: {}, children: [holder.node] };
    });
    const resolved = resolveRelative(holder.node, undefined);
    const kinds = new Set<string>();
    eachPreOrder(resolved, (node) => kinds.add(node.kind));
    assert.deepEqual([...kinds], ["section"]);
  });
});

describe("the command line on Markdown nested far too deep", () => {
  const documents: readonly (readonly [string, string])[] = [
    ["a blockquote", `${">".repeat(10_000)} Hello there.\n`],
    ["a list", `${"- ".repeat(3_000)}item\n`],
    ["a blockquote holding a list", `${"> - ".repeat(2_000)}item [top](#top)\n\n# top\n`],
    ["emphasis", `[top](#top) ${"*".repeat(4_000)}x${"*".repeat(4_000)}\n`],
  ];
  documents.forEach(([label, body]) => {
    it(`lint reads ${label}`, async () => {
      const run = await runCli({ "deep.md": body }, ["deep.md", "--compact"], "en_US.UTF-8");
      assert.ok(run.code === 0 || run.code === 1, run.err);
      assert.match(run.out, /deep\.md/u);
    });
  });

  it("tree reads a deep blockquote", async () => {
    const run = await runCli({ "deep.md": `# Title\n\n${">".repeat(10_000)} 第1条 本文\n` }, ["tree", "deep.md"]);
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /^\(doc/u);
  });

  // The structure tree is as deep as the language package's numbering, not as the Markdown's nesting, so JSON.stringify holds.
  it("tree --format json reads a deep blockquote", async () => {
    const run = await runCli({ "deep.md": `# Title\n\n${">".repeat(10_000)} 第1条 本文\n` }, ["tree", "deep.md", "--format", "json"]);
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /^\{\n {2}"kind": "doc"/u);
  });
});
