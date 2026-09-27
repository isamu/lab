import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { parseJapaneseNumber } from "../packages/lang-ja/src/structure.ts";
import { buildStructure } from "../packages/chaff/src/structure/build.ts";
import { toSexp } from "../packages/chaff/src/structure/sexp.ts";
import type { StructureNode, StructurePatterns } from "../packages/chaff/src/plugin.ts";

const patterns = (): StructurePatterns => {
  if (ja.structure === undefined) throw new Error("lang-ja has no structure");
  return ja.structure;
};

const treeOf = (source: string, markdown = false): StructureNode => buildStructure({ path: "c.txt", source, language: "ja", markdown }, patterns());

/** doc 行を除いた S 式。見本と丸ごと比べる。 */
const body = (source: string, markdown = false): string => toSexp(treeOf(source, markdown)).split("\n").slice(1).join("\n");

const lines = (...rows: string[]): string => rows.join("\n");

describe("日本語の契約書を木にする", () => {
  it("条・項・号の入れ子、番地、定義・参照・義務・数量", () => {
    const source = lines(
      "第1条（目的）",
      "本契約は、甲乙間の売買について定める。",
      "第2条（定義）",
      "本契約において「本件商品」とは、別紙記載の商品をいう。",
      "甲が乙に支払う代金（以下「本件代金」という。）は、第3条に定める。",
      "第3条（支払）",
      "乙は、本件代金を納品後30日以内に支払わなければならない。",
      "２　前項の支払は、第12条第1項に定める方法による。",
      "一　銀行振込",
      "二　現金",
    );
    assert.equal(
      body(source),
      lines(
        '  (article "1" :heading "目的" :label "第1条" :line 1)',
        '  (article "2" :heading "定義" :label "第2条" :line 3',
        '    (definition :term "本件商品" :line 4)',
        '    (definition :term "本件代金" :line 5)',
        '    (reference :label "第3条" :target "3" :line 5))',
        '  (article "3" :heading "支払" :label "第3条" :line 6',
        '    (quantity :unit "日" :value 30 :line 7)',
        '    (obligation :marker "なければならない" :type "must" :line 7)',
        '    (item "3.2" :label "２" :line 8',
        '      (reference :label "第12条第1項" :target "12.1" :line 8)',
        '      (item "3.2.1" :label "一" :line 9)',
        '      (item "3.2.2" :label "二" :line 10))))',
      ),
    );
  });

  it("行頭の「第3条に定める」は条の見出しではない", () => {
    const tree = treeOf(lines("第1条（目的）", "第3条に定めるとおり、乙は遅延してはならない。"));
    assert.deepEqual(
      tree.children.map((node) => node.address),
      ["1"],
    );
    assert.deepEqual(
      tree.children[0]?.children.map((node) => node.kind),
      ["reference", "obligation"],
    );
  });

  it("番号だけの「２　」「一　」は条の中でだけ項・号と読む", () => {
    assert.deepEqual(
      treeOf("3 人で作業する。").children.map((node) => node.kind),
      [],
    );
    assert.deepEqual(
      treeOf(lines("第5条", "3 人で作業する。")).children[0]?.children.map((node) => node.address),
      ["5.3"],
    );
  });

  it("漢数字・全角数字・枝番号を番地にする", () => {
    const tree = treeOf(lines("第十二条（解除）", "第１３条", "第3条の2（特則）", "第3条の2第1項を準用する。"));
    assert.deepEqual(
      tree.children.map((node) => [node.address, node.attrs["label"]]),
      [
        ["12", "第十二条"],
        ["13", "第１３条"],
        ["3-2", "第3条の2"],
      ],
    );
    assert.equal(tree.children[2]?.children[0]?.attrs["target"], "3-2.1");
  });

  it("「（1）」「（2）」は兄弟になり、全角でも同じ番地になる", () => {
    const tree = treeOf(lines("第1条", "（1）第一の場合", "（２）第二の場合"));
    assert.deepEqual(
      tree.children[0]?.children.map((node) => [node.address, node.attrs["label"]]),
      [
        ["1.1", "（1）"],
        ["1.2", "（2）"],
      ],
    );
  });

  it("義務の語は長い方で一度だけ数える", () => {
    const leaves = treeOf("支払わなければならない。").children.filter((node) => node.kind === "obligation");
    assert.deepEqual(
      leaves.map((node) => node.attrs["marker"]),
      ["なければならない"],
    );
  });

  it("Markdown の見出しに書いた条も読む", () => {
    assert.equal(
      body(lines("# 利用規約", "", "## 第3条（支払）", "", "利用者は料金を支払うものとする。"), true),
      lines(
        '  (section "h1" :heading "利用規約" :line 1',
        '    (article "3" :heading "支払" :label "第3条" :line 3',
        '      (obligation :marker "ものとする" :type "must" :line 5))))',
      ),
    );
  });
});

describe("parseJapaneseNumber", () => {
  const cases: readonly (readonly [string, number | undefined])[] = [
    ["3", 3],
    ["１２", 12],
    ["十", 10],
    ["十二", 12],
    ["二十一", 21],
    ["百五", 105],
    ["千二百三十四", 1234],
    ["一〇", 10],
    ["", undefined],
    ["三a", undefined],
  ];
  cases.forEach(([text, expected]) => {
    it(`「${text}」→ ${String(expected)}`, () => assert.equal(parseJapaneseNumber(text), expected));
  });
});
