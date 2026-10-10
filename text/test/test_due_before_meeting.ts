import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { actionDueBeforeMeeting, isBeforeMeeting, type ActionWords } from "../packages/chaff/src/structure/action-due.ts";

// 議事録の宿題の期限が会議の日より前（due-before-issue の meeting）。例文はすべて自作。

const RULE = "due-before-issue";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const jaMinutes = (head: string, body: string): string => `# 定例会 議事録\n\n${head}\n\n場所：会議室A\n\n## 宿題\n\n${body}\n`;
const enMinutes = (head: string, body: string): string => `# Minutes: Weekly Sync\n\n${head}\n\nPlace: Room A\n\n## Action items\n\n${body}\n`;

const JA_TABLE = (due: string, extra = ""): string => `| 担当 | 内容 | 期限 |\n| --- | --- | --- |\n| 木村 | 見積を取る${extra} | ${due} |`;
const EN_TABLE = (due: string, extra = ""): string => `| Owner | Task | Due |\n| --- | --- | --- |\n| Kim | Get a quote${extra} | ${due} |`;

const WORDS: ActionWords = { meeting: ["日時"], section: ["宿題"], earlier: ["前回"], due: ["期限"], done: ["済"], minutes: ["議事録"] };

describe("due-before-issue: 宿題の期限が会議の日より前", () => {
  it("宿題の表の期限の列が会議の日より前なら指す", () => {
    assert.deepEqual(findingsOf(jaMinutes("日時：2026年6月10日（水）10:00〜11:00", JA_TABLE("2026年6月5日（金）"))), [
      "宿題の期限（2026年6月5日）が、会議の日（2026年6月10日）より前です",
    ]);
    assert.deepEqual(findingsOf(enMinutes("Date: Wednesday, June 10, 2026, 10:00 a.m.", EN_TABLE("Friday, June 5, 2026")), en), [
      "The action item's due date June 5, 2026 is before the meeting date June 10, 2026",
    ]);
  });

  it("箇条書きの「（期限 …）」「(due …)」も読む", () => {
    assert.deepEqual(findingsOf(jaMinutes("開催日：2026年6月10日", "- 木村：見積を取る（期限 2026年6月5日）\n- 森：案を書く（締切：2026年6月20日）")), [
      "宿題の期限（2026年6月5日）が、会議の日（2026年6月10日）より前です",
    ]);
    assert.deepEqual(
      findingsOf(enMinutes("Meeting date: June 10, 2026", "- Kim: get a quote (due Friday, June 5, 2026)\n- Lee: draft the plan (deadline June 20, 2026)"), en),
      ["The action item's due date June 5, 2026 is before the meeting date June 10, 2026"],
    );
  });

  it("期限が会議の日と同じか後なら言わない", () => {
    assert.deepEqual(findingsOf(jaMinutes("日時：2026年6月10日", JA_TABLE("2026年6月10日"))), []);
    assert.deepEqual(findingsOf(jaMinutes("日時：2026年6月10日", JA_TABLE("2026年6月17日"))), []);
    assert.deepEqual(findingsOf(enMinutes("Date: June 10, 2026", EN_TABLE("June 17, 2026")), en), []);
  });

  it("済んだ宿題は言わない", () => {
    assert.deepEqual(findingsOf(jaMinutes("日時：2026年6月10日", JA_TABLE("2026年6月5日", "（済）"))), []);
    assert.deepEqual(findingsOf(jaMinutes("日時：2026年6月10日", "- 木村：見積を取る（期限 2026年6月5日、完了）")), []);
    assert.deepEqual(findingsOf(enMinutes("Date: June 10, 2026", EN_TABLE("June 5, 2026", " (done)")), en), []);
    const status = "| Owner | Task | Due | Status |\n| --- | --- | --- | --- |\n| Kim | Get a quote | June 5, 2026 | Done |";
    assert.deepEqual(findingsOf(enMinutes("Date: June 10, 2026", status), en), []);
    const middle = "| 担当 | 状況 | 期限 |\n| --- | --- | --- |\n| 木村 | 済 | 2026年6月5日 |";
    assert.deepEqual(findingsOf(jaMinutes("日時：2026年6月10日", middle)), []);
    assert.deepEqual(findingsOf(enMinutes("Date: June 10, 2026", "- [x] Kim: get a quote (due June 5, 2026)"), en), []);
    assert.deepEqual(findingsOf(jaMinutes("日時：2026年6月10日", "- 木村：見積を取る（期限 2026年6月5日） 済")), []);
  });

  it("作業の名の中の「done」「完了」は済んだ印と読まない", () => {
    const expected = ["The action item's due date June 5, 2026 is before the meeting date June 10, 2026"];
    assert.deepEqual(findingsOf(enMinutes("Date: June 10, 2026", EN_TABLE("June 5, 2026", " (abandoned site)")), en), expected);
    assert.deepEqual(
      findingsOf(enMinutes("Date: June 10, 2026", "| Owner | Task | Due |\n| --- | --- | --- |\n| Kim | Complete the review | June 5, 2026 |"), en),
      expected,
    );
    assert.deepEqual(findingsOf(jaMinutes("日時：2026年6月10日", JA_TABLE("2026年6月5日", "、完了の報告を書く"))), [
      "宿題の期限（2026年6月5日）が、会議の日（2026年6月10日）より前です",
    ]);
  });

  it("題が議事録でない文書は言わない", () => {
    const plan = "# Project plan\n\nDate: June 10, 2026\n\n## Next steps\n\n| Workstream | Due |\n| --- | --- |\n| Requirements review | June 5, 2026 |\n";
    assert.deepEqual(findingsOf(plan, en), []);
    assert.deepEqual(findingsOf(`# 計画書\n\n日付：2026年6月10日\n\n## 宿題\n\n${JA_TABLE("2026年6月5日")}\n`), []);
  });

  it("前回の宿題の節は言わない", () => {
    const ja2 = `# 定例会 議事録\n\n日時：2026年6月10日\n\n## 前回の宿題\n\n${JA_TABLE("2026年6月5日")}\n\n## 宿題\n\n${JA_TABLE("2026年6月17日")}\n`;
    assert.deepEqual(findingsOf(ja2), []);
    const en2 = `# Minutes\n\nDate: June 10, 2026\n\n## Action items\n\n### Previous action items\n\n${EN_TABLE("June 5, 2026")}\n\n### New\n\n${EN_TABLE("June 17, 2026")}\n`;
    assert.deepEqual(findingsOf(en2, en), []);
  });

  it("宿題の節の外の日付と、頭の方に会議の日が無い文書は言わない", () => {
    assert.deepEqual(findingsOf(`# 定例会 議事録\n\n日時：2026年6月10日\n\n## 経過\n\n${JA_TABLE("2026年6月5日")}\n`), []);
    const late = [
      "# 定例会 議事録",
      ...Array.from({ length: 12 }, (_, index) => `\n第${String(index + 1)}項。`),
      "\n日時：2026年6月10日",
      "\n## 宿題\n",
      JA_TABLE("2026年6月5日"),
    ].join("\n");
    assert.deepEqual(findingsOf(late), []);
    assert.deepEqual(findingsOf(`# 定例会 議事録\n\n## 宿題\n\n${JA_TABLE("2026年6月5日")}\n`), []);
    const both = `# 定例会 議事録\n\n日時：2026年6月10日\n\n## 経過\n\n${JA_TABLE("2026年6月1日")}\n\n## 宿題\n\n${JA_TABLE("2026年6月5日")}\n`;
    assert.deepEqual(findingsOf(both), ["宿題の期限（2026年6月5日）が、会議の日（2026年6月10日）より前です"]);
  });

  it("期限の升に日付が二つあれば比べず、表の後の箇条書きは箇条書きとして読む", () => {
    assert.deepEqual(findingsOf(jaMinutes("日時：2026年6月10日", JA_TABLE("2026年6月5日→2026年6月19日"))), []);
    const after = `${EN_TABLE("June 17, 2026")}\n\nAlso:\n\n- Lee: draft the plan (due June 5, 2026)`;
    assert.deepEqual(findingsOf(enMinutes("Date: June 10, 2026", after), en), [
      "The action item's due date June 5, 2026 is before the meeting date June 10, 2026",
    ]);
  });

  it("期限の列の無い表、期限の語の無い箇条書きは読まない", () => {
    assert.deepEqual(findingsOf(jaMinutes("日時：2026年6月10日", "| 担当 | 日付 |\n| --- | --- |\n| 木村 | 2026年6月5日 |")), []);
    assert.deepEqual(findingsOf(enMinutes("Date: June 10, 2026", "- Kim reported on the June 5, 2026 visit."), en), []);
  });

  it("年の無い会議の日で、年を越す期限は言わない", () => {
    assert.deepEqual(findingsOf(jaMinutes("日時：12月20日（月）", JA_TABLE("1月10日"))), []);
    assert.deepEqual(findingsOf(enMinutes("Date: December 20", "- Kim: get a quote (due Jan 10)"), en), []);
    assert.deepEqual(findingsOf(jaMinutes("日時：10月6日（火）", JA_TABLE("10月2日"))), ["宿題の期限（10月2日）が、会議の日（10月6日）より前です"]);
    assert.deepEqual(findingsOf(enMinutes("Date: October 6", "- Kim: get a quote (due Oct 2)"), en), [
      "The action item's due date October 2 is before the meeting date October 6",
    ]);
  });

  it("isBeforeMeeting: 年のある日付は暦で、年の無い日付は年越しを見て比べる", () => {
    assert.equal(isBeforeMeeting("2026-06-05", "2026-06-10"), true);
    assert.equal(isBeforeMeeting("2026-06-10", "2026-06-10"), false);
    assert.equal(isBeforeMeeting("2027-01-10", "2026-12-20"), false);
    assert.equal(isBeforeMeeting("01-10", "12-20"), false);
    assert.equal(isBeforeMeeting("01-10", "2026-12-20"), false);
    assert.equal(isBeforeMeeting("10-02", "10-06"), true);
    assert.equal(isBeforeMeeting("06-05", "2026-06-10"), true);
    assert.equal(isBeforeMeeting("2026-06", "2026-06-10"), false);
    assert.equal(isBeforeMeeting("", ""), false);
  });

  it("請求書は今までどおり読む", () => {
    assert.deepEqual(findingsOf("# 請求書\n\n発行日：2026年11月30日\n\nお支払期限：2026年11月25日\n"), [
      "期限（2026年11月25日）が、発行日（2026年11月30日）より前です",
    ]);
  });

  it("語の無い言語と空の入力", () => {
    const empty: ActionWords = { meeting: [], section: [], earlier: [], due: [], done: [], minutes: [] };
    assert.deepEqual(actionDueBeforeMeeting("日時：2026年6月10日", [{ offset: 3, value: "2026-06-10" }], [], empty), []);
    assert.deepEqual(actionDueBeforeMeeting("", [], [], WORDS), []);
    assert.deepEqual(findingsOf(""), []);
  });
});
