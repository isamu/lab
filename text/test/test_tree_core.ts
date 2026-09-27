import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildStructure } from "../packages/chaff/src/structure/build.ts";
import { toSexp } from "../packages/chaff/src/structure/sexp.ts";
import { lineNumberAt, linesOf } from "../packages/chaff/src/structure/lines.ts";
import { inOrder, treeLanguage, treeTargets } from "../packages/chaff/src/commands/tree.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
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

  it("飛ばした見出しの深さは 0 と数え、番地に空の部品を作らない", () => {
    assert.deepEqual(addresses(treeOf(["# A", "### C", "## D"].join("\n"), true)), ["h1", "h1.0.1", "h1.1"]);
  });

  it("見出しに書いた番号は見出しの深さで入れ子にし、見出しの通し番号も進める", () => {
    const tree = treeOf(["# 規約", "## 前文", "## §3 支払", "### 詳細", "## §4 解除"].join("\n"), true);
    assert.deepEqual(
      tree.children[0]?.children.map((node) => [node.address, node.children.map((child) => child.address)]),
      [
        ["h1.1", []],
        ["3", ["h1.2.1"]],
        ["4", []],
      ],
    );
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

describe("inOrder", () => {
  const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  it("finishes each file before starting the next, whatever each one takes", async () => {
    const events: string[] = [];
    const slowFirst: Readonly<Record<string, number>> = { a: 30, b: 0, c: 10 };
    await inOrder(["a", "b", "c"], async (path) => {
      events.push(`start ${path}`);
      await delay(slowFirst[path] ?? 0);
      events.push(`end ${path}`);
      return true;
    });
    assert.deepEqual(events, ["start a", "end a", "start b", "end b", "start c", "end c"]);
  });

  it("keeps going after a failure, and reports it", async () => {
    const seen: string[] = [];
    const ok = await inOrder(["a", "b", "c"], (path) => {
      seen.push(path);
      return Promise.resolve(path !== "b");
    });
    assert.equal(ok, false);
    assert.deepEqual(seen, ["a", "b", "c"]);
  });
});

describe("chaff tree の言語", () => {
  const context = {
    config: { ...EMPTY, language: "ja", baseDir: "/repo", byPath: [{ files: ["docs/en/**/*.txt"], genre: undefined, language: "en" }] },
    flag: (argv: readonly string[], name: string) => {
      const at = argv.indexOf(name);
      return at === -1 ? undefined : argv[at + 1];
    },
  };

  it("lint と同じく by_path を全体の言語より先に見る", () => {
    assert.equal(treeLanguage("/repo/docs/en/contract.txt", "第1条", ["tree"], context), "en");
    assert.equal(treeLanguage("/repo/docs/ja/contract.txt", "Section 1", ["tree"], context), "ja");
  });

  it("--language はどれよりも先に効く", () => {
    assert.equal(treeLanguage("/repo/docs/en/contract.txt", "", ["tree", "--language", "zh"], context), "zh");
  });

  it("設定が無ければ中身から推定する", () => {
    assert.equal(treeLanguage("/x/a.txt", "The Buyer shall pay within 30 days.", ["tree"], { ...context, config: EMPTY }), "en");
  });
});

describe("大きな文書", () => {
  // 旧実装は行ごとに配列を作り直し、見出しごとに全行を探していたので、この大きさで数十秒かかった。
  // 負荷のかかった CI でも落ちないよう、上限は線形の実装の何十倍も緩くしてある。
  const GENEROUS_MS = 5000;

  const timed = (build: () => StructureNode): { readonly ms: number; readonly tree: StructureNode } => {
    const started = performance.now();
    const tree = build();
    return { ms: performance.now() - started, tree };
  };

  it("何万行の .txt も線形で木にする", () => {
    const source = Array.from({ length: 60_000 }, (_, index) => (index % 100 === 0 ? `§${String(index / 100 + 1)} part` : "- 1 text ->§1")).join("\n");
    const { ms, tree } = timed(() => treeOf(source));
    assert.equal(tree.children.length, 600);
    assert.ok(ms < GENEROUS_MS, `${String(Math.round(ms))} ms`);
  });

  it("見出しが何万ある Markdown も線形で木にする", () => {
    const source = Array.from({ length: 30_000 }, (_, index) => `## Heading ${String(index)}`).join("\n");
    const { ms, tree } = timed(() => treeOf(source, true));
    assert.equal(tree.children.length, 30_000);
    assert.ok(ms < GENEROUS_MS, `${String(Math.round(ms))} ms`);
  });
});

// 行と位置は木の全部が頼る。書き直した二つを、読んで分かる実装と生成した入力で突き合わせる。
const PIECES = ["", "a", "bc", "\r", " ", "第3条"];

/** 3 つの断片を \n か \r\n でつないだ、すべての組み合わせ。 */
const generatedSources = (): string[] => {
  const triples = PIECES.flatMap((first) => PIECES.flatMap((second) => PIECES.map((third) => [first, second, third])));
  return triples.flatMap((parts) => ["\n", "\r\n"].map((newline) => parts.join(newline)));
};

const referenceLines = (source: string) =>
  source.split("\n").map((raw, index, all) => ({
    text: raw.replace(/\r$/u, ""),
    start: all.slice(0, index).reduce((sum, part) => sum + part.length + 1, 0),
    number: index + 1,
  }));

/** 文書と、その中のすべての位置（末尾の次も含む）。 */
const everyOffset = (sources: readonly string[]): { readonly source: string; readonly offset: number }[] =>
  sources.flatMap((source) => Array.from({ length: source.length + 1 }, (_, offset) => ({ source, offset })));

describe("linesOf と lineNumberAt を素直な実装と比べる", () => {
  const sources = generatedSources();

  it("行の分け方が同じ", () => {
    sources.forEach((source) => assert.deepEqual(linesOf(source), referenceLines(source), JSON.stringify(source)));
  });

  it("どの位置についても、含む行が同じ", () => {
    everyOffset(sources).forEach(({ source, offset }) => {
      const expected = referenceLines(source).find((line) => offset >= line.start && offset <= line.start + line.text.length)?.number;
      assert.equal(lineNumberAt(linesOf(source), offset), expected, `${JSON.stringify(source)} @${String(offset)}`);
    });
  });
});
