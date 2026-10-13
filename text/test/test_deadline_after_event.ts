import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import {
  isRegistrationDeadline,
  isTicketOrder,
  isTicketPaymentDeadline,
  isTripNotice,
  isTripPaymentDeadline,
  rangeStartOf,
  type EventDeadlineWords,
} from "../packages/chaff/src/structure/deadline-after-event.ts";

// 申込締切が催しの日より後（deadline-after-event）。例文はすべて自作。

const RULE = "deadline-after-event";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter, "a.md", "business/email").findings;

const JA_EVENT = "# ご案内\n\n日時：2026年11月20日（金）14:00〜17:00\n\n";
const EN_EVENT = "# Invitation\n\nDate: Friday, November 20, 2026, 2:00 PM to 5:00 PM\n\n";

describe("deadline-after-event: 申込締切が催しの日より後", () => {
  it("催しの日より後の申込締切を指す", () => {
    assert.deepEqual(findingsOf(`${JA_EVENT}申込締切：2026年11月27日（金）\n`), ["申込の締め切り（2026年11月27日）が、催しの日（2026年11月20日）より後です"]);
    assert.deepEqual(
      findingsOf(`${JA_EVENT}2026年11月27日（金）までに、同封の申込書をお送りください。11月6日現在、95名の方にお申し込みいただいております。\n`),
      ["申込の締め切り（2026年11月27日）が、催しの日（2026年11月20日）より後です"],
    );
    assert.deepEqual(findingsOf(`${EN_EVENT}Please register by Friday, November 27, 2026, by returning the enclosed form.\n`, en), [
      "The registration deadline November 27, 2026 is after the event on November 20, 2026",
    ]);
    assert.deepEqual(findingsOf("# Fair\n\nWhen: Saturday 28 November 2026, 10:00 to 15:00\n\nBooking deadline: Saturday 5 December 2026\n", en), [
      "The registration deadline 5 December 2026 is after the event on 28 November 2026",
    ]);
  });

  it("複数形の申込の語も読む", () => {
    assert.deepEqual(findingsOf(`${EN_EVENT}Registrations close Friday, November 27, 2026.\n`, en), [
      "The registration deadline November 27, 2026 is after the event on November 20, 2026",
    ]);
  });

  it("催しの日より前か同じ日の締め切りは言わない", () => {
    assert.deepEqual(findingsOf(`${JA_EVENT}申込締切：2026年11月13日（金）\n`), []);
    assert.deepEqual(findingsOf(`${JA_EVENT}出欠のご返信は、2026年11月20日までにお願いします。\n`), []);
    assert.deepEqual(findingsOf(`${EN_EVENT}Please RSVP by Friday, November 13, 2026.\n`, en), []);
  });

  it("催しの後のアンケートや支払の期限は言わない", () => {
    assert.deepEqual(findingsOf(`${JA_EVENT}アンケート回答期限：2026年12月4日（金）\n`), []);
    assert.deepEqual(findingsOf(`${JA_EVENT}お申し込みの方は、2026年12月4日までにアンケートにご回答ください。\n`), []);
    assert.deepEqual(findingsOf(`${EN_EVENT}The survey is due by December 4, 2026.\n`, en), []);
    assert.deepEqual(findingsOf(`${EN_EVENT}Registered guests will receive the invoice; payment is due by December 18, 2026.\n`, en), []);
  });

  it("時刻の無い日付の行、年の無い日付、日付が二つある文は比べない", () => {
    assert.deepEqual(findingsOf("# Memo\n\nDate: October 1, 2026\n\nPlease register by October 20, 2026.\n", en), []);
    assert.deepEqual(findingsOf(`${JA_EVENT}申込締切：11月27日（金）\n`), []);
    assert.deepEqual(findingsOf(`${EN_EVENT}Please register by November 13, 2026 for the follow-up session on December 4, 2026.\n`, en), []);
  });

  it("催しの日が複数あれば、いちばん後の日と比べる", () => {
    const series = "# 連続講座\n\n日時：2026年11月20日（金）14:00〜\n\n日時：2026年12月11日（金）14:00〜\n\n申込締切：2026年11月27日（金）\n";
    assert.deepEqual(findingsOf(series), []);
  });

  it("催しの日の行が無ければ、コードの中も読まない", () => {
    assert.deepEqual(findingsOf("# ご案内\n\n申込締切：2026年11月27日（金）\n"), []);
    assert.deepEqual(findingsOf("# 例\n\n```\n日時：2026年11月20日（金）14:00〜\n申込締切：2026年11月27日（金）\n```\n"), []);
  });

  it("チケットの注文では、公演の後の支払期限を支払の期限として指す", () => {
    const jaOrder = "# チケットご注文のご確認\n\n日時：2026年12月12日（土）18:30開演\n\n";
    const enOrder = "# Your Ticket Order\n\nDate: Saturday, December 12, 2026, 18:30\n\n";
    assert.deepEqual(findingsOf(`${jaOrder}お支払い期限：2026年12月15日（火）\n`), ["支払の期限（2026年12月15日）が、催しの日（2026年12月12日）より後です"]);
    assert.deepEqual(findingsOf(`${jaOrder}2026年12月15日までに代金をお振り込みください。\n`), [
      "支払の期限（2026年12月15日）が、催しの日（2026年12月12日）より後です",
    ]);
    assert.deepEqual(findingsOf(`${enOrder}Payment due by: Tuesday, December 15, 2026\n`, en), [
      "The payment deadline December 15, 2026 is after the event on December 12, 2026",
    ]);
    assert.deepEqual(findingsOf("# Tickets for the winter gala\n\nDate: Saturday, December 12, 2026, 18:30\n\nPlease pay by December 15, 2026.\n", en), [
      "The payment deadline December 15, 2026 is after the event on December 12, 2026",
    ]);
    assert.deepEqual(findingsOf(`${jaOrder}申込締切：2026年12月15日（火）\n`), ["申込の締め切り（2026年12月15日）が、催しの日（2026年12月12日）より後です"]);
    assert.deepEqual(findingsOf(`${enOrder}Please register by December 15, 2026.\n`, en), [
      "The registration deadline December 15, 2026 is after the event on December 12, 2026",
    ]);
    assert.deepEqual(findingsOf(`${enOrder}Please register and pay by December 15, 2026.\n`, en), [
      "The payment deadline December 15, 2026 is after the event on December 12, 2026",
    ]);
    assert.deepEqual(findingsOf(`${jaOrder}2026年12月15日までにお申し込みとご入金をお願いします。\n`), [
      "支払の期限（2026年12月15日）が、催しの日（2026年12月12日）より後です",
    ]);
  });

  it("公演の前の支払期限、題名にチケットの語の無い文書、請求書の支払期限は言わない", () => {
    assert.deepEqual(findingsOf("# チケットご注文のご確認\n\n日時：2026年12月12日（土）18:30開演\n\nお支払い期限：2026年12月4日（金）\n"), []);
    assert.deepEqual(findingsOf(`${JA_EVENT}お支払い期限：2026年12月4日（金）\n`), []);
    assert.deepEqual(
      findingsOf(`# 研修のご案内\n\n日時：2026年11月20日（金）14:00〜\n\n座席に限りがあります。受講料のお支払い期限：2026年12月4日（金）\n`),
      [],
    );
    assert.deepEqual(findingsOf("# チケット販売代行料のご請求\n\n日時：2026年11月20日（金）14:00〜\n\nお支払い期限：2026年12月31日（木）\n"), []);
    assert.deepEqual(
      findingsOf("# Invoice\n\nDate: Friday, November 20, 2026, 2:00 PM\n\nServices: hall hire on the date above.\n\nPayment due by: December 31, 2026\n", en),
      [],
    );
    assert.deepEqual(
      findingsOf("# Ticket sales commission\n\nDate: Friday, November 20, 2026, 2:00 PM\n\nPlease pay this invoice by December 31, 2026.\n", en),
      [],
    );
    assert.deepEqual(findingsOf("# Your Ticket Order\n\nDate: Saturday, December 12, 2026, 18:30\n\nThe survey is due by December 15, 2026.\n", en), []);
    assert.deepEqual(findingsOf("# Seat map\n\nDate: Saturday, December 12, 2026, 18:30\n\nPlease pay by December 15, 2026.\n", en), []);
    assert.deepEqual(findingsOf("# 座席表\n\n日時：2026年12月12日（土）18:30開演\n\nお支払い期限：2026年12月15日（火）\n"), []);
  });

  it("期日の語（due）は旅行の知らせの外では締め切りと読まない", () => {
    assert.deepEqual(findingsOf(`${EN_EVENT}Registration is due to open on Friday, November 27, 2026.\n`, en), []);
    assert.deepEqual(
      findingsOf("# Your Ticket Order\n\nDate: Saturday, December 12, 2026, 18:30\n\nPayment is due to be processed on December 15, 2026.\n", en),
      [],
    );
  });

  it("メールの頭の Date: は催しの日と読まない", () => {
    assert.deepEqual(findingsOf("Date: Friday, November 20, 2026, 2:00 PM\n\nPlease register by Friday, November 27, 2026.\n", en), []);
  });
});

describe("isRegistrationDeadline", () => {
  const WORDS: EventDeadlineWords = {
    events: [],
    registrations: ["申込", "register"],
    deadlines: ["まで", "by"],
    asides: ["アンケート", "survey", "支払", "payment"],
    tickets: ["チケット", "ticket"],
    payments: ["支払", "Payment"],
    bills: ["請求", "invoice"],
    trips: [],
    starts: [],
    paymentDeadlines: [],
    dues: [],
  };

  it("申込の語と締め切りの語の両方があれば締め切りと読む", () => {
    assert.equal(isRegistrationDeadline("12月4日までにお申込ください", { ...WORDS, registrations: ["申込"] }), true);
    assert.equal(isRegistrationDeadline("Please register by Friday", WORDS), true);
  });

  it("片方だけ、後に来てよいものの語、語の一部（registered, nearby）は読まない", () => {
    assert.equal(isRegistrationDeadline("申込締切", { ...WORDS, deadlines: ["まで"] }), false);
    assert.equal(isRegistrationDeadline("12月4日までにご回答ください", WORDS), false);
    assert.equal(isRegistrationDeadline("申込者は12月4日までにアンケートへ", WORDS), false);
    assert.equal(isRegistrationDeadline("95 members registered nearby", WORDS), false);
    assert.equal(isRegistrationDeadline("", WORDS), false);
  });
});

describe("isTicketPaymentDeadline / isTicketOrder", () => {
  const WORDS: EventDeadlineWords = {
    events: [],
    registrations: ["申込"],
    deadlines: ["まで", "期限", "by"],
    asides: ["アンケート", "支払", "payment"],
    tickets: ["チケット", "ticket"],
    payments: ["支払", "Payment"],
    bills: ["請求", "invoice"],
    trips: [],
    starts: [],
    paymentDeadlines: [],
    dues: [],
  };

  it("支払の語と締め切りの語があれば、支払の語が後に来てよいものの語でも読む", () => {
    assert.equal(isTicketPaymentDeadline("お支払い期限：2026年12月15日", WORDS), true);
    assert.equal(isTicketPaymentDeadline("payment due by December 15", WORDS), true);
  });

  it("片方だけ、ほかの後に来てよいものの語、空の文は読まない", () => {
    assert.equal(isTicketPaymentDeadline("お支払い方法：振込", WORDS), false);
    assert.equal(isTicketPaymentDeadline("期限：12月15日", WORDS), false);
    assert.equal(isTicketPaymentDeadline("アンケートのお支払い期限", WORDS), false);
    assert.equal(isTicketPaymentDeadline("", WORDS), false);
  });

  it("題名にチケットの語があり、請求書の語が無いときだけチケットの注文", () => {
    assert.equal(isTicketOrder("チケットご注文のご確認", "お支払い期限", WORDS), true);
    assert.equal(isTicketOrder("Your Ticket Order", "Payment due by", WORDS), true);
    assert.equal(isTicketOrder(undefined, "チケット", WORDS), false);
    assert.equal(isTicketOrder("ご案内", "チケット", WORDS), false);
    assert.equal(isTicketOrder("チケット販売代行料", "ご請求金額", WORDS), false);
    assert.equal(isTicketOrder("Ticket sales", "Please pay this Invoice", WORDS), false);
    assert.equal(isTicketOrder("Tickets", "", { ...WORDS, tickets: [] }), false);
  });
});

describe("deadline-after-event: 旅行の知らせの、出発の後の納入期限", () => {
  const JA_TRIP = "# 修学旅行のお知らせ\n\n出発日：2026年10月14日（水）\n\n";
  const EN_TRIP = "# School Trip to York\n\nDeparture: Wednesday 14 October 2026\n\n";
  const JA_LATE = ["支払の期限（2026年10月20日）が、催しの日（2026年10月14日）より後です"];
  const EN_LATE = ["The payment deadline 20 October 2026 is after the event on 14 October 2026"];

  it("出発日・期間の始まりより後の納入期限を指す", () => {
    assert.deepEqual(findingsOf(`${JA_TRIP}納入期限：2026年10月20日（火）\n`), JA_LATE);
    assert.deepEqual(
      findingsOf("# 林間学校のお知らせ\n\n期間：2026年10月14日（水）〜16日（金）\n\n- 第2回：6,000円（納入期限 2026年10月20日（火））\n"),
      JA_LATE,
    );
    assert.deepEqual(findingsOf("# 修学旅行のお知らせ\n\n旅行期間：2026年10月14日〜2026年10月16日\n\n2026年10月15日までに旅行代金をお振り込みください。\n"), [
      "支払の期限（2026年10月15日）が、催しの日（2026年10月14日）より後です",
    ]);
    assert.deepEqual(findingsOf(`${EN_TRIP}Payment due: Tuesday 20 October 2026\n`, en), EN_LATE);
    assert.deepEqual(
      findingsOf("# Outdoor Camp\n\nDates: Wednesday, October 14 – Friday, October 16, 2026\n\n- Second payment: $60, due Tuesday, October 20, 2026\n", en),
      ["The payment deadline October 20, 2026 is after the event on October 14, 2026"],
    );
  });

  it("納入期限の列の表の升も読む", () => {
    const jaRows = "| 第1回 | 30,000円 | 2026年9月15日（火） |\n| 第2回 | 32,000円 | 2026年10月20日（火） |\n";
    assert.deepEqual(findingsOf(`${JA_TRIP}| 回 | 金額 | 納入期限 |\n| --- | --- | --- |\n${jaRows}`), JA_LATE);
    assert.deepEqual(findingsOf(`${JA_TRIP}| 回 | 金額 | 引き落とし日 |\n| --- | --- | --- |\n${jaRows}`), JA_LATE);
    const enRows = "| 1st payment | £170 | Tuesday 15 September 2026 |\n| 2nd payment | £150 | Tuesday 20 October 2026 |\n";
    assert.deepEqual(findingsOf(`${EN_TRIP}| Instalment | Amount | Due by |\n| --- | --- | --- |\n${enRows}`, en), EN_LATE);
  });

  it("出発の前の納入期限、納入期限でない列、帰着日、返金は言わない", () => {
    assert.deepEqual(findingsOf(`${JA_TRIP}納入期限：2026年9月30日（水）\n`), []);
    assert.deepEqual(findingsOf(`${EN_TRIP}Payment due: Wednesday 30 September 2026\n`, en), []);
    assert.deepEqual(findingsOf(`${JA_TRIP}| 日 | 行き先 |\n| --- | --- |\n| 2026年10月15日 | 奈良 |\n`), []);
    assert.deepEqual(findingsOf(`${JA_TRIP}帰着日：2026年10月16日（金）\n`), []);
    assert.deepEqual(findingsOf(`${JA_TRIP}残金は2026年10月30日までに返金として振り込みます。\n`), []);
    assert.deepEqual(findingsOf(`${EN_TRIP}We return on Friday 16 October 2026, due to the half-term break.\n`, en), []);
    assert.deepEqual(findingsOf(`${EN_TRIP}Any refund payment will be made by Friday 30 October 2026.\n`, en), []);
    assert.deepEqual(findingsOf(`${EN_TRIP}Permission slip due date: Tuesday 20 October 2026\n`, en), []);
  });

  it("旅行の知らせでない文書の期間、請求書や納品の支払期限は言わない", () => {
    assert.deepEqual(findingsOf("# 電気料金のお知らせ\n\n期間：2026年9月1日〜2026年9月30日\n\n納付期限：2026年10月20日\n"), []);
    assert.deepEqual(findingsOf("# 旅行代金のご請求\n\n出発日：2026年10月14日（水）\n\n納入期限：2026年10月20日（火）\n"), []);
    assert.deepEqual(findingsOf("# 納品のお知らせ\n\n納品日：2026年10月14日\n\nお支払期限：2026年11月30日\n"), []);
    assert.deepEqual(findingsOf("# Statement\n\nDates: September 1–30, 2026\n\nPayment due: October 20, 2026\n", en), []);
    assert.deepEqual(findingsOf("# Tour invoice\n\nDeparture: 14 October 2026\n\nPayment due: 20 October 2026\n", en), []);
  });
});

describe("isTripNotice / isTripPaymentDeadline", () => {
  const WORDS: EventDeadlineWords = {
    events: [],
    registrations: [],
    deadlines: ["まで", "due"],
    asides: ["返金", "refund", "支払", "payment"],
    tickets: [],
    payments: ["支払", "payment"],
    bills: ["請求", "invoice"],
    trips: ["旅行", "trip"],
    starts: [],
    paymentDeadlines: ["納入期限", "payment due"],
    dues: ["due"],
  };

  it("題名に旅行の語があり、請求書の語が無いときだけ旅行の知らせ", () => {
    assert.equal(isTripNotice("修学旅行のお知らせ", "", WORDS), true);
    assert.equal(isTripNotice("School Trip", "", WORDS), true);
    assert.equal(isTripNotice(undefined, "旅行", WORDS), false);
    assert.equal(isTripNotice("お知らせ", "旅行", WORDS), false);
    assert.equal(isTripNotice("旅行代金", "ご請求金額", WORDS), false);
    assert.equal(isTripNotice("Trip invoice", "", WORDS), false);
  });

  it("納入期限の語、その列の見出し、支払の語と締め切りの語を読む", () => {
    assert.equal(isTripPaymentDeadline("納入期限：10月20日", undefined, WORDS), true);
    assert.equal(isTripPaymentDeadline("| 第2回 | 10月20日 |", "納入期限", WORDS), true);
    assert.equal(isTripPaymentDeadline("| 2nd payment | £150 | 20 October |", "Due by", WORDS), true);
    assert.equal(isTripPaymentDeadline("Second payment: $60, due October 20", undefined, WORDS), true);
  });

  it("見出しが納入期限でない列、締め切りの語だけ、返金の語、空の文は読まない", () => {
    assert.equal(isTripPaymentDeadline("| 第2回 | 10月20日 |", "備考", WORDS), false);
    assert.equal(isTripPaymentDeadline("due to rain", undefined, WORDS), false);
    assert.equal(isTripPaymentDeadline("返金の納入期限", undefined, WORDS), false);
    assert.equal(isTripPaymentDeadline("refund payment due by October 30", undefined, WORDS), false);
    assert.equal(isTripPaymentDeadline("Permission slip due date: October 20", undefined, WORDS), false);
    assert.equal(isTripPaymentDeadline("", undefined, WORDS), false);
  });
});

describe("rangeStartOf", () => {
  it("期間の始まりの日。年の無い始まりは終わりの年を借りる", () => {
    assert.equal(rangeStartOf(["2026-10-14", "2026-10-16"]), "2026-10-14");
    assert.equal(rangeStartOf(["10-14", "2026-10-16"]), "2026-10-14");
    assert.equal(rangeStartOf(["12-30", "2027-01-02"]), "2026-12-30");
    assert.equal(rangeStartOf(["07-09", "2026-07-08"]), "2026-07-09");
    assert.equal(rangeStartOf(["2026-10-16"]), "2026-10-16");
  });

  it("日付が無い、年がどこにも無い、年月だけのものは読まない", () => {
    assert.equal(rangeStartOf([]), undefined);
    assert.equal(rangeStartOf(["10-14", "10-16"]), undefined);
    assert.equal(rangeStartOf(["2026-10"]), undefined);
  });
});
