import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isNameList } from "../packages/chaff/src/detectors/name-list-sentence.ts";

// max-sentence-length and a list of names or titles joined by 、 (an attendee list). Each item names someone, and the line
// says nothing, so it is not a long sentence. Every example here is self-written.

before(async () => {
  await ja.prepare?.({ pos: true });
});

const findingsOf = (source: string): readonly string[] => namedRuleRun("max-sentence-length", `${source}\n`, ja).findings;

const TITLES = ["市長", "副市長", "教育長", "総務部長", "企画部長", "財政課長", "人事課長", "試験センター所長", "選挙管理委員会事務局長", "まちづくり担当部長"];
const ATTENDEES = TITLES.join("、");
/** Long enough to pass the limit of a report (140 characters) if it were counted. */
const LONG_LIST = [ATTENDEES, ATTENDEES, ATTENDEES].join("、");

describe("isNameList", () => {
  it("reads five or more short items that end in a name or a title, with no full stop", () => {
    assert.equal(isNameList(ATTENDEES), true);
    assert.equal(isNameList("市長、副市長、教育長、総務部長、企画部参事（財政課長）"), true);
    assert.equal(isNameList("市長、副市長、教育長、健康生きがい部長、総務部長"), true);
    assert.equal(isNameList("山田一郎，佐藤花子，鈴木次郎，田中三郎，高橋四郎"), true);
  });

  it("does not read a sentence, a clause list, a short list or a list with a long item", () => {
    assert.equal(isNameList(`${ATTENDEES}。`), false);
    assert.equal(isNameList(`${ATTENDEES}が出席した`), false);
    assert.equal(isNameList("市長、副市長、教育長、総務部長"), false);
    assert.equal(isNameList("計画を説明し、予算を確認し、日程を決め、担当を割り振り、次回に報告する"), false);
    assert.equal(isNameList("市長、副市長、教育長、総務部長、試験と検査の結果をまとめて報告する担当の部長"), false);
    assert.equal(isNameList("市長、、副市長、教育長、総務部長、企画部長"), false);
    assert.equal(isNameList(Array.from({ length: 6 }, () => "本計画は来年度から実施予定").join("、")), false);
    assert.equal(isNameList("市長、副市長、教育長、総務部長、企画部長。】"), false);
    assert.equal(isNameList("Ann, Bob, Carol, Dave, Eve, Frank."), false);
    assert.equal(isNameList(""), false);
  });
});

describe("max-sentence-length on an attendee list", () => {
  it("does not count a list of titles as a long sentence", () => {
    assert.deepEqual(findingsOf(`#### 出席者\n\n${LONG_LIST}`), []);
  });

  it("still counts a long sentence that lists the same titles", () => {
    assert.deepEqual(findingsOf(`本日の会議には、${LONG_LIST}が出席し、来年度の予算と日程について意見を述べた。`), [
      "この文は 218 文字あります（140 文字まで）",
    ]);
  });
});
