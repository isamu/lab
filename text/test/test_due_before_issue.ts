import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { dueBeforeIssue, type DueWords } from "../packages/chaff/src/structure/due-date.ts";
import { withoutLabelVersion } from "../packages/chaff/src/structure/versioned-label.ts";

// 期限が発行日より前（due-before-issue）。例文はすべて自作。

const RULE = "due-before-issue";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const WORDS: DueWords = { issue: ["発行日"], due: ["お支払期限"], passed: [] };

describe("due-before-issue: 期限が発行日より前", () => {
  it("発行日より前の期限を指す", () => {
    assert.deepEqual(findingsOf("# 請求書\n\n発行日：2026年11月30日\n\nお支払期限：2026年11月25日\n"), [
      "期限（2026年11月25日）が、発行日（2026年11月30日）より前です",
    ]);
    assert.deepEqual(findingsOf("# Invoice\n\nIssued: November 30, 2026\n\nPayment due: November 25, 2026\n", en), [
      "The due date November 25, 2026 is before the issue date November 30, 2026",
    ]);
  });

  it("期限が発行日と同じか後なら言わない", () => {
    assert.deepEqual(findingsOf("# 請求書\n\n発行日：2026年11月30日\n\nお支払期限：2026年12月25日\n"), []);
    assert.deepEqual(findingsOf("# 請求書\n\n発行日：2026年11月30日\n\nお支払期限：2026年11月30日\n"), []);
  });

  it("学費や税の納入期限・納付期限も期限と読む", () => {
    ["納入期限", "納入期日", "納付期限", "納付期日"].forEach((label) => {
      assert.deepEqual(
        findingsOf(`# 学費納入通知書\n\n発行日：2026年3月10日\n\n${label}：2026年3月3日\n`),
        ["期限（2026年3月3日）が、発行日（2026年3月10日）より前です"],
        label,
      );
      assert.deepEqual(findingsOf(`# 学費納入通知書\n\n発行日：2026年3月10日\n\n${label}：2026年3月31日\n`), [], label);
    });
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

const JA_NOTES = (support: string): string => `# まめ帳簿 3.0.0 リリースノート\n\nリリース日：2026年9月29日\n\n本文です。\n\n${support}\n`;
const EN_NOTES = (support: string): string => `# Ledgerly 5.0.0 Release Notes\n\nRelease date: September 29, 2026\n\nBody text.\n\n${support}\n`;

describe("due-before-issue: リリース日より前のサポート終了日", () => {
  it("リリース日より前のサポート終了日を指す。版を書いた語も、書かない語も読む", () => {
    ["サポート終了日：2025年9月30日", "3.0.0 のサポート終了日：2025年9月30日", "v3.0 のサポート期限：2025年9月30日"].forEach((line) => {
      assert.equal(findingsOf(JA_NOTES(line)).length, 1, line);
    });
    ["End of support: September 30, 2025", "End of support for 5.0.0: September 30, 2025", "Support ends for v5.0: September 30, 2025"].forEach((line) => {
      assert.equal(findingsOf(EN_NOTES(line), en).length, 1, line);
    });
    assert.deepEqual(findingsOf(EN_NOTES("End of support for 5.0.0: September 30, 2025"), en), [
      '"End of support" September 30, 2025 is before "Release date" September 29, 2026',
    ]);
  });

  it("リリース日より後のサポート終了日は言わない", () => {
    assert.deepEqual(findingsOf(JA_NOTES("3.0.0 のサポート終了日：2028年9月30日")), []);
    assert.deepEqual(findingsOf(EN_NOTES("End of support for 5.0.0: September 30, 2028"), en), []);
  });

  it("版でないものや、版の後ろに語が続く行は読まない", () => {
    [
      "End of support for enterprise customers: September 30, 2025",
      "End of support for 5: September 30, 2025",
      "End of support for 5.0.0 users: September 30, 2025",
      "End of support for 5.0.0-beta: September 30, 2025",
      "End of support with 5.0.0: September 30, 2025",
      "Note: End of support for 5.0.0: September 30, 2025",
    ].forEach((line) => assert.deepEqual(findingsOf(EN_NOTES(line), en), [], line));
    ["法人のサポート終了日：2025年9月30日", "なお 3.0.0 のサポート終了日：2025年9月30日", "3.0.0 と 2.0 のサポート終了日：2025年9月30日"].forEach((line) =>
      assert.deepEqual(findingsOf(JA_NOTES(line)), [], line),
    );
  });

  it("リリース日の語は、ほかの組の発行日にならない", () => {
    assert.deepEqual(findingsOf("# 請求書\n\nリリース日：2026年11月30日\n\nお支払期限：2026年11月25日\n"), []);
    assert.deepEqual(findingsOf("# Price list\n\nRelease date: November 30, 2026\n\nValid until: November 25, 2026\n", en), []);
  });
});

describe("withoutLabelVersion", () => {
  const words = { after: ["for"], before: ["の"] };

  it("版を除いた語の行を返す", () => {
    assert.equal(withoutLabelVersion("End of support for 5.0.0: September 30, 2025", "End of support", words), "End of support: September 30, 2025");
    assert.equal(withoutLabelVersion("- end of support FOR v5.0 | 2025", "End of support", words), "end of support | 2025");
    assert.equal(withoutLabelVersion("| 3.0.0 のサポート終了日 | 2025年9月30日 |", "サポート終了日", words), "サポート終了日 | 2025年9月30日 |");
    assert.equal(withoutLabelVersion("3.0の　サポート終了日：2025年9月30日", "サポート終了日", words), "サポート終了日：2025年9月30日");
    assert.equal(withoutLabelVersion("1. 3.0.0 のサポート終了日：2025年9月30日", "サポート終了日", words), "サポート終了日：2025年9月30日");
    assert.equal(withoutLabelVersion("2) End of support for 5.0.0: 2025", "End of support", words), "End of support: 2025");
  });

  it("版を書いていない行、版でないもの、語の無い言語では undefined", () => {
    assert.equal(withoutLabelVersion("End of support: September 30, 2025", "End of support", words), undefined);
    assert.equal(withoutLabelVersion("End of support for 2026: September 30, 2025", "End of support", words), undefined);
    assert.equal(withoutLabelVersion("End of support for: September 30, 2025", "End of support", words), undefined);
    assert.equal(withoutLabelVersion("End of supportfor 5.0: September 30, 2025", "End of support", words), undefined);
    assert.equal(withoutLabelVersion("3.0.0 サポート終了日：2025年9月30日", "サポート終了日", words), undefined);
    assert.equal(withoutLabelVersion("3.0.0 の法人のサポート終了日：2025年9月30日", "サポート終了日", words), undefined);
    assert.equal(withoutLabelVersion("End of support for 5.0.0: September 30, 2025", "End of support", { after: [], before: [] }), undefined);
    assert.equal(withoutLabelVersion("", "End of support", words), undefined);
  });
});
