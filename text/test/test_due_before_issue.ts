import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { dueBeforeIssue, type DueWords } from "../packages/chaff/src/structure/due-date.ts";

// 期限が発行日より前（due-before-issue）。例文はすべて自作。

const RULE = "due-before-issue";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const WORDS: DueWords = { issue: ["発行日"], due: ["お支払期限"], passed: [] };

describe("due-before-issue: 期限が発行日より前", () => {
  it("発行日より前の期限を指す", () => {
    assert.deepEqual(findingsOf("# 請求書\n\n発行日：2026年11月30日\n\nお支払期限：2026年11月25日\n"), ["期限（2026年11月25日）が、発行日（2026年11月30日）より前です"]);
    assert.deepEqual(findingsOf("# Invoice\n\nIssued: November 30, 2026\n\nPayment due: November 25, 2026\n", en), [
      "The due date November 25, 2026 is before the issue date November 30, 2026",
    ]);
  });

  it("期限が発行日と同じか後なら言わない", () => {
    assert.deepEqual(findingsOf("# 請求書\n\n発行日：2026年11月30日\n\nお支払期限：2026年12月25日\n"), []);
    assert.deepEqual(findingsOf("# 請求書\n\n発行日：2026年11月30日\n\nお支払期限：2026年11月30日\n"), []);
  });

  it("表の行と箇条書きも読む", () => {
    assert.deepEqual(findingsOf("| 項目 | 日付 |\n| --- | --- |\n| 発行日 | 2026年11月30日 |\n| 有効期限 | 2026年10月31日 |\n"), [
      "期限（2026年10月31日）が、発行日（2026年11月30日）より前です",
    ]);
    assert.deepEqual(findingsOf("- Invoice date: November 30, 2026\n- Due date: November 1, 2026\n", en), [
      "The due date November 1, 2026 is before the issue date November 30, 2026",
    ]);
  });

  it("行の頭に語の無い日付、語に別の語が続く行、コードの中は読まない", () => {
    assert.deepEqual(findingsOf("# 請求書\n\n発行日：2026年11月30日\n\n2026年11月25日までにお支払いください。\n"), []);
    assert.deepEqual(findingsOf("# Note\n\nIssued: November 30, 2026\n\nDue to the holiday, we closed on November 25, 2026.\n", en), []);
    assert.deepEqual(findingsOf("# 例\n\n```\n発行日：2026年11月30日\nお支払期限：2026年11月25日\n```\n"), []);
  });

  it("過ぎた期限を報告する行と、発行日から離れた期限は比べない", () => {
    assert.deepEqual(findingsOf("# 証明書の棚卸し\n\n発行日：2026年10月8日\n\n| 項目 | 内容 |\n| --- | --- |\n| 有効期限 | 2026年3月31日（期限切れ） |\n"), []);
    assert.deepEqual(findingsOf("# Account statement\n\nIssued: October 8, 2026\n\n- Due: September 15, 2026 (invoice 1041, overdue)\n", en), []);
    const far = ["発行日：2026年11月30日", ...Array.from({ length: 8 }, (_, index) => `\n第${String(index + 1)}項。`), "\nお支払期限：2026年11月25日"].join(
      "\n",
    );
    assert.deepEqual(findingsOf(`# 請求書\n\n${far}\n`), []);
  });

  it("作成日は発行日と読まない", () => {
    assert.deepEqual(findingsOf("# 棚卸し\n\n作成日：2026年10月8日\n\n有効期限：2026年3月31日\n"), []);
  });

  it("発行日が無いか、一行に日付が二つある行は比べない", () => {
    assert.deepEqual(findingsOf("# 請求書\n\nお支払期限：2026年11月25日\n"), []);
    assert.deepEqual(findingsOf("# 請求書\n\n発行日：2026年11月30日\n\nお支払期限：2026年11月25日（再発行 2026年12月1日）\n"), []);
  });

  it("語の無い言語と空の入力", () => {
    const dates = [
      { offset: 4, value: "2026-11-30" },
      { offset: 20, value: "2026-11-25" },
    ];
    assert.deepEqual(dueBeforeIssue("発行日：2026年11月30日\nお支払期限：2026年11月25日", dates, { issue: [], due: [], passed: [] }), []);
    assert.deepEqual(dueBeforeIssue("", [], WORDS), []);
    assert.deepEqual(findingsOf(""), []);
  });
});
