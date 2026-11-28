import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { headLines } from "../packages/chaff/src/detectors/email-letter.ts";
import { closingIn, isSalutation } from "../packages/chaff/src/detectors/email-frame-words.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// email-greeting-closing and the forms a greeting or a closing takes between colleagues: a name alone as the salutation,
// a closing that opens the last sentence of a line, a short よろしく, an internal notice ending on whom to ask, and a
// header field (Withdrawn: …) before a memo's labels. Every example is self-written.

const variantsOf = (adapter: LanguageAdapter, source: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "business/email")
    .findings.filter((finding) => finding.rule === "email-greeting-closing")
    .map((finding) => finding.variant ?? "");

const EN_ENDS = [".", "?", "!"];

describe("isSalutation: a name alone as the salutation", () => {
  it("takes a short line of words ending with the salutation mark", () => {
    assert.equal(isSalutation("Priya,", [","], EN_ENDS), true);
    assert.equal(isSalutation("Ms Lee,", [","], EN_ENDS), true);
  });

  it("does not take a sentence, a long line, a line with no mark, or a line without a letter", () => {
    assert.equal(isSalutation("The plan is ready, as promised,", [","], EN_ENDS), false);
    assert.equal(isSalutation("Priya", [","], EN_ENDS), false);
    assert.equal(isSalutation("Done.", [","], EN_ENDS), false);
    assert.equal(isSalutation("12,", [","], EN_ENDS), false);
    assert.equal(isSalutation("Priya,", [], EN_ENDS), false);
  });
});

describe("closingIn: a closing at the head of the line or of one of its sentences", () => {
  it("reads a Latin closing that opens a later sentence of the line", () => {
    assert.equal(closingIn("All set for Monday. Thanks, and have a good weekend!", ["Thanks"], EN_ENDS), true);
    assert.equal(closingIn("Best regards,", ["Best regards"], EN_ENDS), true);
  });

  it("does not read a closing word inside a sentence", () => {
    assert.equal(closingIn("All set for Monday, thanks to the team.", ["Thanks"], EN_ENDS), false);
    assert.equal(closingIn("We are all set for Monday.", ["Thanks"], EN_ENDS), false);
  });
});

describe("headLines: a header field is not the first sentence", () => {
  it("reads past a labelled field that ends with a full stop", () => {
    const source = ["LETTERHEAD", "", "Withdrawn: This letter was withdrawn on 1 May.", "", "SUBJECT:", "", "Body starts here."].join("\n");
    assert.deepEqual(headLines(source, EN_ENDS), ["LETTERHEAD", "Withdrawn: This letter was withdrawn on 1 May.", "SUBJECT:"]);
  });

  it("still stops at a sentence that is not a field", () => {
    const source = ["Quick note: the office is shut.", "SUBJECT:"].join("\n");
    assert.deepEqual(headLines(source, EN_ENDS), []);
  });
});

describe("email-greeting-closing: the forms between colleagues", () => {
  const EN_NAME = ["Subject: Comments", "", "Ann,", "", "The draft is in the shared drive. Can you comment by Wednesday?", "", "Thanks,", "Dan"].join("\n");
  const EN_LAST_SENTENCE = [
    "Subject: Office closed",
    "",
    "Hi everyone,",
    "",
    "The office is closed on Friday for maintenance.",
    "",
    "It reopens on Monday. Thanks, and enjoy the day at home!",
    "",
    "Sam",
  ].join("\n");
  const EN_SEE_YOU = ["Subject: Lunch", "", "Hey all,", "", "Lunch is at 12:30 on Friday.", "", "See you there,", "Mike"].join("\n");
  const EN_SORRY = [
    "Subject: This morning",
    "",
    "Hi Ann,",
    "",
    "I missed our meeting. Could we meet on Thursday?",
    "",
    "Sorry again for the wasted morning.",
    "",
    "Tom",
  ].join("\n");

  it("takes these English forms for a greeting and a closing", () => {
    assert.deepEqual(variantsOf(en, EN_NAME), []);
    assert.deepEqual(variantsOf(en, EN_LAST_SENTENCE), []);
    assert.deepEqual(variantsOf(en, EN_SEE_YOU), []);
    assert.deepEqual(variantsOf(en, EN_SORRY), []);
  });

  it("still reports an English email that opens on its business and ends on a name", () => {
    const bare = ["Subject: Comments", "", "The draft is in the shared drive. Can you comment by Wednesday?", "", "Dan"].join("\n");
    assert.deepEqual(variantsOf(en, bare), ["greeting", "closing"]);
  });

  const JA_SHORT = [
    "件名：資料のレビュー",
    "",
    "中村さん",
    "",
    "お疲れさま。",
    "資料のレビューをお願いしたい。",
    "",
    "木曜までにコメントをもらえると助かる。",
    "",
    "よろしく。",
    "鈴木",
  ].join("\n");
  const JA_LATE = [
    "件名：Re: 勉強会の件",
    "",
    "佐藤さん",
    "",
    "返信が遅くなってしまい、すみません。",
    "勉強会にはぜひ参加させてください。",
    "",
    "引き続きよろしくお願いします。",
    "",
    "田中",
  ].join("\n");
  const JA_NOTICE = [
    "件名：研修のご案内",
    "",
    "各位",
    "",
    "お疲れさまです。総務部の山田です。",
    "研修を下記のとおり行います。",
    "",
    "■日時",
    "11月20日 15時から",
    "",
    "ご不明な点は総務部山田までお願いします。",
  ].join("\n");

  it("takes お疲れさま, an apology for a late reply, よろしく and whom to ask for a greeting and a closing", () => {
    assert.deepEqual(variantsOf(ja, JA_SHORT), []);
    assert.deepEqual(variantsOf(ja, JA_LATE), []);
    assert.deepEqual(variantsOf(ja, JA_NOTICE), []);
  });

  it("still reports a Japanese email that opens on its business and ends on its last request", () => {
    const bare = ["件名：資料のレビュー", "", "中村さん", "", "資料のレビューをお願いしたい。", "", "木曜までにコメントをもらえると助かる。", "", "鈴木"].join(
      "\n",
    );
    assert.deepEqual(variantsOf(ja, bare), ["greeting", "closing"]);
  });

  const MEMO = [
    "BOARD OF EXAMPLES",
    "",
    "Withdrawn: On 1 May this letter was withdrawn.",
    "",
    "TO THE OFFICERS IN CHARGE:",
    "",
    "SUBJECT:",
    "",
    "A statement on lending",
    "",
    "The agencies issue this statement on lending.",
    "",
    "signed by",
    "Ann Lee",
    "",
    "Last Update: 1 June",
  ].join("\n");

  it("reads a memo whose labels follow a header field that ends with a full stop", () => {
    assert.deepEqual(variantsOf(en, MEMO), []);
  });
});
