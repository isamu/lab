import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bodyLines, firstMention, frameSlips, lineHas, ownText, showsAttachment, withoutReplyMarks } from "../packages/chaff/src/detectors/email-letter.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// A work email's own parts: a greeting and a closing, the subject line, and an attachment the text mentions. Every
// example is self-written.

const findingsOf = (adapter: LanguageAdapter, rule: string, source: string, genre = "business/email"): Finding[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.filter((finding) => finding.rule === rule);

const variantsOf = (adapter: LanguageAdapter, rule: string, source: string, genre?: string): string[] =>
  findingsOf(adapter, rule, source, genre).map((finding) => finding.variant ?? "");

const linesIn = (text: string) => bodyLines(text, text, []);

const JA_MAIL = [
  "件名: 打ち合わせの日程",
  "",
  "株式会社北浜商事",
  "総務部 山田様",
  "",
  "いつもお世話になっております。日程をお知らせします。",
  "",
  "10月13日の14時からです。",
  "",
  "よろしくお願いいたします。",
  "",
  "佐藤",
  "",
].join("\n");
const EN_MAIL = [
  "Subject: Meeting date",
  "",
  "Dear facilities team,",
  "",
  "The meeting is on 13 October at 14:00.",
  "",
  "Best regards,",
  "Ichiro",
  "Sales team",
  "",
].join("\n");

describe("lineHas: a greeting or closing word in a line", () => {
  it("reads a Latin word at the line's head only, and not as part of a longer word", () => {
    assert.ok(lineHas("Hi Anna,", ["Hi"]));
    assert.ok(lineHas("  best regards,", ["Best regards"]));
    assert.ok(!lineHas("History of the room", ["Hi"]));
    assert.ok(!lineHas("We said hi.", ["Hi"]));
  });

  it("reads a Japanese word anywhere in the line", () =>
    assert.ok(lineHas("株式会社みなとの佐藤です。いつもお世話になっております。", ["お世話になっております"])));
});

describe("email-greeting-closing: a greeting and a closing", () => {
  it("reports nothing for an email with both", () => {
    assert.deepEqual(variantsOf(ja, "email-greeting-closing", JA_MAIL), []);
    assert.deepEqual(variantsOf(en, "email-greeting-closing", EN_MAIL), []);
  });

  it("reports a missing greeting and a missing closing", () => {
    assert.deepEqual(variantsOf(ja, "email-greeting-closing", JA_MAIL.replace("いつもお世話になっております。", "")), ["greeting"]);
    assert.deepEqual(variantsOf(en, "email-greeting-closing", EN_MAIL.replace("Best regards,", "")), ["closing"]);
  });

  it("finds a closing before an appendix or a signature that breaks the text", () => {
    assert.deepEqual(variantsOf(en, "email-greeting-closing", `${EN_MAIL}\n## Appendix A\n\nTerms one.\n\nTerms two.\n`), []);
    const lines = linesIn("Dear Ann,\n\nText.\n\nThanks,\nBo\n\n# Terms\n\nOne.\n");
    assert.deepEqual(frameSlips(lines, ["Dear"], ["Thanks"]), []);
    assert.deepEqual(
      lines.map((line) => line.breaks),
      [false, false, false, false, true],
    );
  });

  it("finds a closing in a part of its own when the text after it runs long", () => {
    const appendix = Array.from({ length: 12 }, (_, index) => `Term ${String(index + 1)}.`).join("\n\n");
    assert.deepEqual(variantsOf(en, "email-greeting-closing", `${EN_MAIL}\n## Appendix A\n\n${appendix}\n`), []);
  });

  it("leaves the header's field lines out, and breaks the text where prose masks a line", () => {
    const source = "Subject: Lunch\nDate: Mon\n\nHi Ann,\nText.\n";
    const prose = "         Lunch\n         \n\nHi Ann,\nText.\n";
    assert.deepEqual(
      bodyLines(source, prose, []).map((line) => [line.text, line.breaks]),
      [
        ["Hi Ann,", true],
        ["Text.", false],
      ],
    );
  });

  it("leaves out a quoted reply's attribution line as well as its quoted lines", () => {
    const text = "Thanks,\nBo\nOn Tue, Ann wrote:\n> Hi\n";
    assert.deepEqual(
      bodyLines(text, text, [{ start: 11, end: text.length }]).map((line) => line.text),
      ["Thanks,", "Bo"],
    );
  });

  it("does not read a quoted reply", () => {
    const quoted = `${EN_MAIL.replace("Best regards,", "")}\n> Best regards,\n> Ann\n`;
    assert.deepEqual(variantsOf(en, "email-greeting-closing", quoted), ["closing"]);
  });

  it("runs only in the email and letter genre", () =>
    assert.deepEqual(variantsOf(en, "email-greeting-closing", "# Notes\n\nThe meeting is at two.\n", "business/report"), []));
});

describe("email-subject-length: the subject line", () => {
  it("takes the marks a mail program adds off the subject", () => {
    assert.equal(withoutReplyMarks("Re: Fwd: Lunch", ["Re", "Fwd"]), "Lunch");
    assert.equal(withoutReplyMarks("RE：返信：昼食", ["Re", "返信"]), "昼食");
    assert.equal(withoutReplyMarks("Reading list", ["Re"]), "Reading list");
    assert.equal(withoutReplyMarks("Re: Fwd: Lunch: the plan", ["Re", "Fwd"]), "Lunch: the plan");
    assert.equal(withoutReplyMarks(`${"Re: ".repeat(20000)}Lunch`, ["Re"]), "Lunch");
    assert.equal(withoutReplyMarks("Re:", ["Re"]), "");
  });

  it("reports a long subject, in characters, and an empty one", () => {
    const long = JA_MAIL.replace("打ち合わせの日程", "来週の火曜日に予定している会議室の予約サービスの導入に向けた打ち合わせの日程について");
    assert.deepEqual(variantsOf(ja, "email-subject-length", long), [""]);
    assert.deepEqual(variantsOf(en, "email-subject-length", EN_MAIL.replace("Subject: Meeting date", "Subject:")), ["empty"]);
    assert.deepEqual(variantsOf(en, "email-subject-length", EN_MAIL), []);
  });

  it("lets a subject of the limit's length pass, and reports one a character longer", () => {
    const subject = (length: number): string => EN_MAIL.replace("Meeting date", "x".repeat(length));
    assert.deepEqual(variantsOf(en, "email-subject-length", subject(70)), []);
    assert.deepEqual(variantsOf(en, "email-subject-length", subject(71)), [""]);
  });

  it("does not count a reply mark, and checks nothing without a subject line", () => {
    const replied = EN_MAIL.replace("Subject: Meeting date", `Subject: Re: Re: Fwd: ${"x".repeat(60)}`);
    assert.deepEqual(variantsOf(en, "email-subject-length", replied), []);
    assert.deepEqual(variantsOf(en, "email-subject-length", EN_MAIL.replace("Subject: Meeting date\n\n", "")), []);
  });
});

describe("attachment-not-attached: an attachment mentioned and not shown", () => {
  it("finds the first mention, past the phrases that only look like one", () => {
    assert.equal(firstMention(linesIn("The panel is attached to the wall.\nI have attached the plan."), ["attached"], ["attached to"]), 35);
    assert.equal(firstMention(linesIn("添付はありません。"), ["添付"], ["添付はありません"]), undefined);
  });

  it("sees an attachment line, a heading, a file name or the archive's note", () => {
    assert.ok(showsAttachment("Text.\nAttachment: plan.pdf\n", ["Attachment"], [], []));
    assert.ok(showsAttachment("Text.\n\n### Enclosures\n", ["Enclosures"], [], []));
    assert.ok(showsAttachment("See plan_v2.PDF here.", [], ["pdf"], []));
    assert.ok(showsAttachment("An attachment was scrubbed...", [], [], ["was scrubbed..."]));
    assert.ok(!showsAttachment("Attachments are welcome in replies.", ["Attachments"], ["pdf"], []));
  });

  it("reports a mention with nothing attached, in both languages", () => {
    assert.equal(findingsOf(ja, "attachment-not-attached", JA_MAIL.replace("日程をお知らせします。", "資料を添付します。")).length, 1);
    assert.equal(findingsOf(en, "attachment-not-attached", EN_MAIL.replace("14:00.", "14:00. I have attached the plan.")).length, 1);
  });

  it("does not take an old message's attachment in a quoted reply for this one's", () => {
    const quoted = `${EN_MAIL.replace("14:00.", "14:00. I have attached the plan.")}\nOn Tue, Ann wrote:\n> Attachment: old.pdf\n> Thanks\n`;
    assert.equal(findingsOf(en, "attachment-not-attached", quoted).length, 1);
    assert.equal(ownText("ab\n> c.pdf\nd", []), "ab\nd");
    assert.equal(
      ownText("abcdef", [
        { start: 1, end: 3 },
        { start: 2, end: 4 },
      ]),
      "a   ef",
    );
  });

  it("does not report a mention with the attachment listed", () => {
    const listed = EN_MAIL.replace("14:00.", "14:00. I have attached the plan.\n\nAttachment: plan.pdf");
    assert.deepEqual(findingsOf(en, "attachment-not-attached", listed), []);
    assert.deepEqual(findingsOf(ja, "attachment-not-attached", JA_MAIL.replace("日程をお知らせします。", "資料（日程.xlsx）を添付します。")), []);
  });
});
