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

  it("読み手の質問や意見を受け付ける申し出は言わない（条件の語が無くても）", () => {
    ["ご質問はメールでお送りください。", "ご不明点はご連絡ください。", "お気軽にご連絡ください。", "お問い合わせはメールでご連絡ください。"].forEach((source) =>
      assert.deepEqual(findingsOf(source), [], source),
    );
    ["Please send any questions to me.", "Please reply with any questions.", "Please contact us with questions.", "Please send your questions to me."].forEach(
      (source) => assert.deepEqual(findingsOf(source, en), [], source),
    );
  });

  it("読み手の質問を受け付けるのでない依頼は、申し出と読まずに言う", () => {
    assert.deepEqual(findingsOf("署名した同意書をお送りください。"), [MESSAGE_JA]);
    assert.deepEqual(findingsOf("質問票に記入してください。"), [MESSAGE_JA]);
    assert.deepEqual(findingsOf("Please send the signed form.", en), [MESSAGE_EN]);
    assert.deepEqual(findingsOf("未対応のお問い合わせに返信してください。"), [MESSAGE_JA]);
    assert.deepEqual(findingsOf("お客様のご質問に回答してください。"), [MESSAGE_JA]);
    assert.deepEqual(findingsOf("Please review the comments on the draft.", en), [MESSAGE_EN]);
    assert.deepEqual(findingsOf("Please send any feedback from the beta users.", en), [MESSAGE_EN]);
  });

  it("読む場所の案内と、依頼から離れた所にある動作の語は依頼と読まない", () => {
    assert.deepEqual(findingsOf("各項目の詳細は資料の本文をご確認ください。"), []);
    assert.deepEqual(findingsOf("For details, please check the project page.", en), []);
    assert.deepEqual(findingsOf("本検討会の運営方針は、議長の判断にお任せください。"), []);
    assert.deepEqual(findingsOf("個別に回答することは予定しておりませんので、その点ご了承ください。"), []);
  });

  it("語の一部（同様の様、たくさんのさん、3時間の時）は担当や期限と読まない", () => {
    ["同様の内容を確認してください。", "たくさんの資料を確認してください。", "3時間かけて資料を確認してください。"].forEach((source) =>
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

  it("ほかの出来事を基準にした時機が依頼の文にあれば言わない", () => {
    [
      "申込書をご提出いただく前に、要項を必ず確認してください。",
      "送信後、必ずご連絡ください。",
      "申込書の提出時に、明細も提出してください。",
      "3時間後に資料を確認してください。",
    ].forEach((source) => assert.deepEqual(findingsOf(source), [], source));
    assert.deepEqual(findingsOf("Please send the receipt after you pay.", en), []);
    assert.deepEqual(findingsOf("Please review the agenda in advance.", en), []);
  });

  it("時機の語が次の文にあるだけなら言う（次の文は別の話）", () => {
    assert.deepEqual(findingsOf("申込書をご提出ください。その後、面談の日程をお知らせします。"), [MESSAGE_JA]);
    assert.deepEqual(findingsOf("Please send the form. After you leave, the doors lock.", en), [MESSAGE_EN]);
  });

  it("誘いの動詞で終わる依頼と、望む人に向けた依頼は言わない", () => {
    ["会員登録をしにお越しください。", "登録できますのでご相談ください。", "入力用にご使用ください。", "参加したい方は、まずは登録をお願いします。"].forEach(
      (source) => assert.deepEqual(findingsOf(source), [], source),
    );
    assert.deepEqual(findingsOf("Please come to register at the front desk.", en), []);
  });

  it("頼む相手をある人たちに絞る依頼（〜する方は、〜た方は、〜ない方は）は言わない", () => {
    [
      "証明書の発行を申請する方は、必ずご確認ください。",
      "申込書 [PDFファイル／64KB] 証明書の発行を申請される方は、必ずご確認ください。",
      "申し込まれた方は、受付票を保管してください。",
      "印鑑をお持ちでない方は、署名欄に記入してください。",
    ].forEach((source) => assert.deepEqual(findingsOf(source), [], source));
  });

  it("〜者を主語に立てた依頼は、誰がするかを言っているので言わない", () => {
    ["掲載する広告のデザインは出店者が作成してください。", "同意書は保護者が記入してください。", "記入した用紙は記入者は提出してください。"].forEach((source) =>
      assert.deepEqual(findingsOf(source), [], source),
    );
  });

  it("相手を絞らない依頼と、主語でない〜者や「方」は、担当とも条件とも読まずに言う", () => {
    [
      "申込書を提出してください。",
      "書類の書き方を確認してください。",
      "記入の仕方は資料を確認してください。",
      "第三者に渡さず、申込書を提出してください。",
      "使い方を確認して、返信してください。",
    ].forEach((source) => assert.deepEqual(findingsOf(source), [MESSAGE_JA], source));
  });

  it("誘いの動詞が依頼の終わりから離れていれば言う", () => {
    assert.deepEqual(findingsOf("ご相談の内容を記入してください。"), [MESSAGE_JA]);
    assert.deepEqual(findingsOf("Please register the visit in the log.", en), [MESSAGE_EN]);
  });

  it("誘いと読点で区切られた動作は、誘いとは別の依頼として言う", () => {
    assert.deepEqual(findingsOf("申請書を提出し、会場へお越しください。"), [MESSAGE_JA]);
    assert.deepEqual(findingsOf("Please submit the form, then come to the hall.", en), [MESSAGE_EN]);
  });

  it("連絡先の行（札とコロン）と同じ文の依頼は言わない", () => {
    assert.deepEqual(findingsOf("ファックス番号：012-3456-7890\n※送られたら必ずご連絡ください。"), []);
    assert.deepEqual(findingsOf("Fax: 012-345-6789\nPlease confirm receipt with a call.", en), []);
  });

  it("コロンの無い連絡の手段の語は連絡先の行と読まない", () => {
    assert.deepEqual(findingsOf("ファックスで見積書をご提出ください。"), [MESSAGE_JA]);
    assert.deepEqual(findingsOf("Please send the fax to the printer.", en), [MESSAGE_EN]);
  });

  it("見出しが期限を言っていれば、その下の依頼は期限を受け継ぐ", () => {
    const heading = (title: string, body: string): readonly string[] =>
      namedRuleRun(RULE, `# 件\n\n## ${title}\n\n${body}\n`, ja, "a.md", "business/email").findings;
    assert.deepEqual(heading("見積提出期限：2026年10月26日", "### 様式\n\n見積書を確認してください。"), []);
    assert.deepEqual(heading("【随時受付】講師の募集", "履歴書を提出してください。"), []);
    assert.deepEqual(heading("提出書類", "見積書を確認してください。"), [MESSAGE_JA]);
  });

  it("見出しに日付だけがあっても（発出日や催しの日）、期限とは読まない", () => {
    const source = "# 熱中症の防止について（2026年8月22日　事務連絡）\n\n防止策の状況を報告してください。\n";
    assert.deepEqual(namedRuleRun(RULE, source, ja, "a.md", "business/email").findings, [MESSAGE_JA]);
  });

  it("期限を言う見出しは、別の節の依頼には受け継がない", () => {
    const source = "# 件\n\n## 見積提出期限：2026年10月26日\n\n見積書を2026年10月26日までにお送りください。\n\n## 提出書類\n\n見積書を確認してください。\n";
    assert.deepEqual(namedRuleRun(RULE, source, ja, "a.md", "business/email").findings, [MESSAGE_JA]);
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
