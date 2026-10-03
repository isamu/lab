import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { containsAny } from "../packages/chaff/src/detectors/request-owner.ts";

// 期限も担当も無い依頼（request-without-deadline）。例文はすべて自作。

const RULE = "request-without-deadline";
const MESSAGE_JA = "この依頼には、いつまでに・誰がするかが書かれていません";
const MESSAGE_EN = "This request says neither who should do it nor by when";

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const findingsOf = (source: string, adapter = ja, genre = "business/email"): readonly string[] =>
  namedRuleRun(RULE, `# 件\n\n${source}\n`, adapter, "a.md", genre).findings;

describe("request-without-deadline: 期限も担当も無い依頼", () => {
  it("確認や返信を頼む文に、期限も担当も無ければ言う", () => {
    assert.deepEqual(findingsOf("添付の見積書をご確認ください。ほかに質問はありません。"), [MESSAGE_JA]);
    assert.deepEqual(findingsOf("議事録の共有をお願いいたします。"), [MESSAGE_JA]);
    assert.deepEqual(findingsOf("Please review the attached quote. I have no other questions.", en), [MESSAGE_EN]);
  });

  it("期限があれば言わない（語、日付、時刻、次の文）", () => {
    assert.deepEqual(findingsOf("添付の見積書を、来週の金曜までにご確認ください。"), []);
    assert.deepEqual(findingsOf("添付の見積書を2026年10月20日にご確認ください。"), []);
    assert.deepEqual(findingsOf("添付の見積書をご確認ください。15時に電話します。"), []);
    assert.deepEqual(findingsOf("Please review the attached quote by Friday.", en), []);
    assert.deepEqual(findingsOf("Please review the attached quote. We sign on Oct 20.", en), []);
  });

  it("担当があれば言わない（呼び名、役割、人の名前）", () => {
    assert.deepEqual(findingsOf("経理部の担当者が見積書をご確認ください。"), []);
    assert.deepEqual(findingsOf("見積書のご確認をお願いします。山田さんにも伝えます。"), []);
    assert.deepEqual(findingsOf("Please send the report to the finance team.", en), []);
  });

  it("条件付きの申し出と、心構えの依頼は言わない", () => {
    assert.deepEqual(findingsOf("ご不明な点があれば、ご連絡ください。"), []);
    assert.deepEqual(findingsOf("あらかじめご了承ください。"), []);
    assert.deepEqual(findingsOf("どうぞよろしくお願いいたします。"), []);
    assert.deepEqual(findingsOf("If you have questions, please let me know.", en), []);
    assert.deepEqual(findingsOf("Please note that the office is closed.", en), []);
  });

  it("読む場所の案内と、依頼から離れた所にある動作の語は依頼と読まない", () => {
    assert.deepEqual(findingsOf("各項目の詳細は資料の本文をご確認ください。"), []);
    assert.deepEqual(findingsOf("For details, please check the project page.", en), []);
    assert.deepEqual(findingsOf("本検討会の運営方針は、議長の判断にお任せください。"), []);
    assert.deepEqual(findingsOf("個別に回答することは予定しておりませんので、その点ご了承ください。"), []);
  });

  it("語の一部（同様の様、たくさんのさん、3時間の時）は担当や期限と読まない", () => {
    ["同様の内容を確認してください。", "たくさんの資料を確認してください。", "3時間後に資料を確認してください。"].forEach((source) =>
      assert.deepEqual(findingsOf(source), [MESSAGE_JA], source),
    );
    assert.deepEqual(findingsOf("Please review the report. The 3amplitude result changed.", en), [MESSAGE_EN]);
  });

  it("次の文が別の段落か別の項目なら、その文の担当や期限は数えない", () => {
    assert.deepEqual(findingsOf("見積書を確認してください。\n\n山田さんは休みです。"), [MESSAGE_JA]);
    assert.deepEqual(findingsOf("- 見積書を確認してください。\n- 山田さんは休みです。"), [MESSAGE_JA]);
    assert.deepEqual(findingsOf("Please review the report. Tokyo is noisy today in the north.", en), []);
    assert.deepEqual(findingsOf("Please review the report. Tokyo is noisy.", en), [MESSAGE_EN]);
  });

  it("ビジネスの文書でだけ動く", () => {
    const source = "# 件\n\n添付の見積書をご確認ください。ほかに質問はありません。\n";
    assert.ok(firedRules(ja, source, "business/email").includes(RULE));
    ["technical/readme", "blog/tech", "literature/fiction"].forEach((genre) => assert.ok(!firedRules(ja, source, genre).includes(RULE), genre));
  });

  it("英語の語は語の切れ目で当て、日本語の語は字で当てる", () => {
    assert.equal(containsAny("Maybe later.", ["by"]), false);
    assert.equal(containsAny("Send it by Friday.", ["by friday"]), true);
    assert.equal(containsAny("今週中にお願いします。", ["今週"]), true);
    assert.equal(containsAny("", ["今週"]), false);
    assert.equal(containsAny("今週", [""]), false);
  });
});
