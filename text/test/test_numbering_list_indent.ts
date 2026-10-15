import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { listNumberBreaks, nestedLastFinder, writtenNumbers, type WrittenNumber } from "../packages/chaff/src/structure/list-numbering.ts";

// numbering-gap: CommonMark は、親の本文の位置まで字下げしない項目（二つの空白）を同じ箇条書きに入れる。書き手は字下げで入れ子を
// 書いたので、字下げの違う番号は別の並びとして比べる。タブと空白が混ざって入れ子が途中で切れたものも、番号の続きとして読む。例文は自作。

const lines = (...rows: string[]): string => rows.join("\n");

const gapsOf = (source: string): string[] =>
  runRules(buildDocument("m.md", source, ja), loadRules(ja.id), {}, false, "docs/manual")
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => `${String(finding.values["previous"])} ${String(finding.values["label"])}`);

const item = (offset: number, number: number, indent = 0): WrittenNumber => ({ offset, number, label: `${String(number)}.`, indent });

const labelsOf = (issues: ReturnType<typeof listNumberBreaks>): string[] =>
  issues.map((issue) => `${String(issue.values["previous"])} ${String(issue.values["label"])}`);

before(async () => prepare());

describe("numbering-gap: list items indented less than a nested list needs", () => {
  it("does not read sub-items 1–3 indented two spaces, then the next top-level 2., as 3 then 2", () => {
    const source = lines(
      "# 利用の条件",
      "",
      "1. 次の場合に利用できる。",
      "  1. 家族の世話のため",
      "  2. 学び直しのため",
      "  3. その他会社が認めた場合",
      "2. 利用する者は、三十日前までに申し出る。",
      "3. 会社は、申出を受けて可否を決める。",
      "",
    );
    assert.deepEqual(gapsOf(source), []);
  });

  it("does not read a nested list carried on at another indentation as 1 then 5", () => {
    const source = lines(
      "# 活動の定義",
      "",
      "1. 活動とは、次の各号に掲げるものとする。",
      "\t1. 地域の清掃",
      "\t2. 福祉施設の手伝い",
      "\t3. 自然保護",
      "\t4. 大会の運営",
      "  5. 被災地の復興支援",
      "  6. その他、前各号に準ずる活動",
      "",
    );
    assert.deepEqual(gapsOf(source), []);
  });

  it("still reports a gap among the sub-items", () => {
    const source = lines("# 手順", "", "1. 準備する。", "  1. 道具を出す。", "  3. 材料を量る。", "2. 作る。", "");
    assert.deepEqual(gapsOf(source), ["1. 3."]);
  });

  it("still reports a gap among the top-level items across the sub-items", () => {
    const source = lines("# 手順", "", "1. 準備する。", "  1. 道具を出す。", "  2. 材料を量る。", "3. 作る。", "");
    assert.deepEqual(gapsOf(source), ["1. 3."]);
  });

  it("still reports a deeper item that carries on nothing above it", () => {
    const source = lines("# 手順", "", "1. 準備する。", "  5. 作る。", "");
    assert.deepEqual(gapsOf(source), ["1. 5."]);
  });
});

describe("listNumberBreaks with indentation", () => {
  it("reads an item one space deeper that carries on the count as a slip of indentation, not a nested list", () => {
    assert.deepEqual(labelsOf(listNumberBreaks([item(0, 1), item(5, 2, 1), item(10, 3), item(15, 5)])), ["3. 5."]);
  });

  it("compares an item that returns to an indentation with the last item there", () => {
    assert.deepEqual(labelsOf(listNumberBreaks([item(0, 1), item(5, 1, 2), item(10, 2, 2), item(15, 2), item(20, 4)])), ["2. 4."]);
  });

  it("an item shallower than every item before it follows the item it comes after", () => {
    assert.deepEqual(labelsOf(listNumberBreaks([item(0, 1, 2), item(5, 3)])), ["1. 3."]);
    assert.deepEqual(labelsOf(listNumberBreaks([item(0, 1, 2), item(5, 2)])), []);
  });

  it("a deeper item one past the parent's nested list carries that list on", () => {
    const fourInFirst = (parent: { offset: number }): number | undefined => (parent.offset === 0 ? 4 : undefined);
    assert.deepEqual(labelsOf(listNumberBreaks([item(0, 1), item(5, 5, 2), item(10, 6, 2), item(15, 2)], fourInFirst)), []);
    assert.deepEqual(labelsOf(listNumberBreaks([item(0, 1), item(5, 7, 2)], fourInFirst)), ["1. 7."]);
  });
});

describe("nestedLastFinder", () => {
  it("gives the last number of the ordered list nested in an item, passing over a bulleted list after it", () => {
    const source = lines("1. a", "\t1. b", "\t2. c", "\t- note", "2. d");
    const lists = buildDocument("m.md", source, ja).lists.map((list) => list.itemSpans);
    const nestedLast = nestedLastFinder(source, lists);
    const top = writtenNumbers(source, lists.find((spans) => spans[0]?.start === 0) ?? []) ?? [];
    assert.deepEqual(
      top.map((entry) => nestedLast(entry)),
      [2, undefined],
    );
  });
});
