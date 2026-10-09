import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isRegistrationDeadline, type EventDeadlineWords } from "../packages/chaff/src/structure/deadline-after-event.ts";

// 申込締切が催しの日より後（deadline-after-event）。例文はすべて自作。

const RULE = "deadline-after-event";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter, "a.md", "business/email").findings;

const JA_EVENT = "# ご案内\n\n日時：2026年11月20日（金）14:00〜17:00\n\n";
const EN_EVENT = "# Invitation\n\nDate: Friday, November 20, 2026, 2:00 PM to 5:00 PM\n\n";

describe("deadline-after-event: 申込締切が催しの日より後", () => {
  it("催しの日より後の申込締切を指す", () => {
    assert.deepEqual(findingsOf(`${JA_EVENT}申込締切：2026年11月27日（金）\n`), ["申込の締め切り 2026-11-27 が、催しの日 2026-11-20 より後です"]);
    assert.deepEqual(
      findingsOf(`${JA_EVENT}2026年11月27日（金）までに、同封の申込書をお送りください。11月6日現在、95名の方にお申し込みいただいております。\n`),
      ["申込の締め切り 2026-11-27 が、催しの日 2026-11-20 より後です"],
    );
    assert.deepEqual(findingsOf(`${EN_EVENT}Please register by Friday, November 27, 2026, by returning the enclosed form.\n`, en), [
      "The registration deadline 2026-11-27 is after the event on 2026-11-20",
    ]);
    assert.deepEqual(findingsOf("# Fair\n\nWhen: Saturday 28 November 2026, 10:00 to 15:00\n\nBooking deadline: Saturday 5 December 2026\n", en), [
      "The registration deadline 2026-12-05 is after the event on 2026-11-28",
    ]);
  });

  it("複数形の申込の語も読む", () => {
    assert.deepEqual(findingsOf(`${EN_EVENT}Registrations close Friday, November 27, 2026.\n`, en), [
      "The registration deadline 2026-11-27 is after the event on 2026-11-20",
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

  it("メールの頭の Date: は催しの日と読まない", () => {
    assert.deepEqual(findingsOf("Date: Friday, November 20, 2026, 2:00 PM\n\nPlease register by Friday, November 27, 2026.\n", en), []);
  });
});

describe("isRegistrationDeadline", () => {
  const WORDS: EventDeadlineWords = { events: [], registrations: ["申込", "register"], deadlines: ["まで", "by"], asides: ["アンケート", "survey"] };

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
