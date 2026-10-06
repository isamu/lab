import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { relativeDayMismatch } from "../packages/chaff/src/derived/relative-weekdays.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 文書の日付から数えた曜日や日の語（「来週月曜（10月12日）」「明日（10月7日）」"next Monday (October 12)"）と、横に書いた日付の
// 食い違い（relative-date-mismatch）。例文は自作。2026年10月6日は火曜日。

const found = (source: string, adapter: LanguageAdapter, genre = "business/email"): string[] =>
  runRules(buildDocument("m.md", source, adapter), loadRules(adapter.id), { "relative-date-mismatch": "normal" }, false, genre)
    .findings.filter((finding) => finding.rule === "relative-date-mismatch")
    .map((finding) => `${String(finding.values["relative"])} ${String(finding.values["target"])}→${String(finding.values["expected"])}`);

const mailJa = (body: string): string => `件名: 打ち合わせ\n日付: 2026年10月6日\n\n${body}\n`;
const mailEn = (body: string): string => `Subject: Meeting\nDate: Tuesday, October 6, 2026\n\n${body}\n`;

before(async () => prepare());

describe("relative-date-mismatch: day words against the document's date", () => {
  it("ja: 来週・今週・先週と曜日、明日・明後日・昨日", () => {
    assert.deepEqual(found(mailJa("次回は来週月曜（10月13日）の14時からです。"), ja), ["来週月曜 10月13日→10-12"]);
    assert.deepEqual(found(mailJa("次回は来週月曜（10月12日）の14時からです。"), ja), []);
    assert.deepEqual(found(mailJa("次回は来週月曜日の10月12日です。"), ja), []);
    assert.deepEqual(found(mailJa("再来週の火曜ではなく、再来週火曜（10月20日）にします。"), ja), []);
    assert.deepEqual(found(mailJa("再来週火曜（10月21日）にします。"), ja), ["再来週火曜 10月21日→10-20"]);
    assert.deepEqual(found(mailJa("今週金曜（10月9日）までにお願いします。"), ja), []);
    assert.deepEqual(found(mailJa("先週金曜（10月2日）に届きました。"), ja), []);
    assert.deepEqual(found(mailJa("明日（10月8日）に伺います。"), ja), ["明日 10月8日→10-07"]);
    assert.deepEqual(found(mailJa("明後日（10月8日）に伺います。"), ja), []);
  });

  it("en: next / this / last and a weekday, tomorrow and yesterday", () => {
    assert.deepEqual(found(mailEn("We meet next Monday (October 13)."), en), ["next Monday October 13→10-12"]);
    assert.deepEqual(found(mailEn("We meet next Monday (October 12)."), en), []);
    assert.deepEqual(found(mailEn("We met last Friday, October 2."), en), []);
    assert.deepEqual(found(mailEn("We meet tomorrow, October 8."), en), ["tomorrow October 8→10-07"]);
  });

  it("allows every reading of a week: from Monday, from Sunday, the coming one", () => {
    // Sunday, October 11, 2026: next Monday is the 12th (the coming one) or the 19th (the week after).
    const sunday = (target: string): string => `Subject: Meeting\nDate: Sunday, October 11, 2026\n\nWe meet next Monday (${target}).\n`;
    assert.deepEqual(found(sunday("October 12"), en), []);
    assert.deepEqual(found(sunday("October 19"), en), []);
    assert.deepEqual(found(sunday("October 26"), en), ["next Monday October 26→10-12"]);
  });

  it("counts only from a date field of the opening, not from an update stamp, a quoted mail or a dated section", () => {
    const quoted = "Subject: Fwd: meeting\nDate: Tuesday, October 6, 2026\n\n> Date: Wednesday, October 1, 2025\n> We meet tomorrow (October 2).\n";
    assert.deepEqual(found(quoted, en), []);
    assert.deepEqual(
      found("Date: Tuesday, October 6, 2026\n\n## October 1 meeting\n\nToday, October 1, we approved the plan.\n", en, "business/meeting-notes"),
      [],
    );
    assert.deepEqual(found("Updated: October 20, 2026\n\nPress release: Today, October 6, we announced the program.\n", en, "business/press-release"), []);
    const minutes = "# 定例会 議事録\n\n- 日時: 2026年10月5日（月）10時\n\n## 次回\n\n次回は来週月曜（10月19日）の10時から開く。\n";
    assert.deepEqual(found(minutes, ja, "business/meeting-notes"), ["来週月曜 10月19日→10-12"]);
  });

  it("reads nothing without a document date, without a date right after, or with the word far from it", () => {
    assert.deepEqual(found("次回は来週月曜（10月13日）です。\n", ja), []);
    assert.deepEqual(found(mailJa("次回は来週月曜です。10月13日は休みです。"), ja), []);
    assert.deepEqual(found(mailEn("Next week we will talk about Monday. October 13 is a holiday."), en), []);
  });
});

describe("relativeDayMismatch", () => {
  it("returns the day meant, written as the date was, or undefined when the date fits", () => {
    assert.equal(relativeDayMismatch("2026-10-06", { start: 0, end: 1, kind: "day", days: 1 }, "2026-10-08"), "2026-10-07");
    assert.equal(relativeDayMismatch("2026-10-06", { start: 0, end: 1, kind: "day", days: 1 }, "10-08"), "10-07");
    assert.equal(relativeDayMismatch("2026-10-06", { start: 0, end: 1, kind: "day", days: 1 }, "10-07"), undefined);
  });

  it("reads nothing from an impossible base or a date that is not one", () => {
    assert.equal(relativeDayMismatch("2026-02-30", { start: 0, end: 1, kind: "day", days: 1 }, "10-07"), undefined);
    assert.equal(relativeDayMismatch("10-06", { start: 0, end: 1, kind: "day", days: 1 }, "10-07"), undefined);
    assert.equal(relativeDayMismatch("2026-10-06", { start: 0, end: 1, kind: "day", days: 1 }, "2026"), undefined);
  });
});
