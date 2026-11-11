import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { valueBelow, type SubjectVocabulary } from "../packages/chaff/src/detectors/email-letter.ts";
import { withoutReferenceSuffix } from "../packages/chaff/src/detectors/email-subject-reference.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// email-subject-length and a subject set on the line under its label ("SUBJECT:" over the subject). Every example is self-written.

const subjectFindings = (adapter: LanguageAdapter, source: string): Finding[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "business/email").findings.filter(
    (finding) => finding.rule === "email-subject-length",
  );
const variantsOf = (adapter: LanguageAdapter, source: string): string[] => subjectFindings(adapter, source).map((finding) => finding.variant ?? "");

const VOCABULARY: SubjectVocabulary = {
  fields: ["Subject"],
  replyMarks: ["Re"],
  headerFields: ["From", "Subject"],
  greetings: ["Dear", "Hi"],
  sentenceEnds: [".", "?", "!"],
};
const below = (text: string, index = 0): string => {
  const lines: { start: number; text: string }[] = [];
  text.split("\n").forEach((line) => lines.push({ start: (lines.at(-1)?.start ?? 0) + (lines.at(-1)?.text.length ?? -1) + 1, text: line }));
  return valueBelow(lines, index, VOCABULARY);
};

describe("valueBelow: the subject on the line under its label", () => {
  it("takes the next line with text, past blank lines", () => {
    assert.equal(below("SUBJECT:\n\n  Car park repairs  \n\nThe car park closes."), "Car park repairs");
    assert.equal(below("Subject:\nCar park repairs"), "Car park repairs");
    assert.equal(below("Subject:\nRe: Car park repairs"), "Re: Car park repairs");
    assert.equal(below("Subject:\nQ3: budget review at 10:00"), "Q3: budget review at 10:00");
  });

  it("takes a title that ends inside its own quotation marks (Revised “…!”)", () => {
    assert.equal(below("SUBJECT:\n\nRevised “Parking Made Easy!”\n\nThe car park closes."), "Revised “Parking Made Easy!”");
    assert.equal(below('SUBJECT:\n\nNew "Guide to Parking?"'), 'New "Guide to Parking?"');
    assert.equal(below("Subject:\n\n“The car park closes on Monday.”"), "");
  });

  it("leaves the subject empty when the next line is the body, a header field, a quote, or nothing", () => {
    assert.equal(below("Subject:\n\nDear Ann,"), "");
    assert.equal(below("Subject:\n\nThe car park closes on Monday."), "");
    assert.equal(below("Subject:\nFrom: Ann"), "");
    assert.equal(below("Subject:\n> Car park"), "");
    assert.equal(below("Subject:\n\n"), "");
    assert.equal(below("Subject:"), "");
  });
});

describe("email-subject-length with the subject under its label", () => {
  const memo = (subject: string): string =>
    ["TO THE HEAD OF EACH BRANCH OFFICE", "", "SUBJECT:", "", subject, "", "The car park closes on Monday for repairs.", ""].join("\n");

  it("measures the subject under the label: a short one passes, a long one is reported", () => {
    assert.deepEqual(variantsOf(en, memo("Car park repairs")), []);
    const long = "Repairs to the staff car park behind the town hall and the closing of the side gate on Mill Lane";
    assert.deepEqual(
      subjectFindings(en, memo(long)).map((finding) => finding.values?.["count"]),
      [[...long].length],
    );
    assert.deepEqual(
      subjectFindings(en, memo(`Re: ${long}`)).map((finding) => finding.values?.["count"]),
      [[...long].length],
    );
  });

  it("still reports an empty subject followed by the greeting or the body", () => {
    assert.deepEqual(variantsOf(en, "Subject:\n\nDear Ann,\n\nThe car park closes on Monday.\n\nBest regards,\nIchiro\n"), ["empty"]);
    assert.deepEqual(variantsOf(en, "Subject:\n\nThe car park closes on Monday.\n\nBest regards,\nIchiro\n"), ["empty"]);
  });

  it("reads a Japanese subject under 件名：, and still reports an empty one", () => {
    assert.deepEqual(
      variantsOf(ja, "件名：\n駐車場の工事\n\nいつもお世話になっております。月曜日から駐車場を閉鎖します。\n\nよろしくお願いいたします。\n"),
      [],
    );
    assert.deepEqual(variantsOf(ja, "件名：\n\nいつもお世話になっております。月曜日から駐車場を閉鎖します。\n\nよろしくお願いいたします。\n"), ["empty"]);
  });
});

describe("email-subject-length leaves a reference number in brackets at the end out of the count", () => {
  const mail = (subject: string): string => [`件名：${subject}`, "", "山田様", "", "お世話になっております。", ""].join("\n");

  it("does not count an order or ticket number in brackets at the end", () => {
    assert.deepEqual(subjectFindings(ja, mail("【お詫び】ご注文商品の誤配送について（ご注文番号：A-20481）")), []);
    assert.equal(withoutReferenceSuffix("Refund for the damaged chair (Order #58213)"), "Refund for the damaged chair");
    assert.equal(withoutReferenceSuffix("請求書の再発行について（請求番号 2026103101）"), "請求書の再発行について");
  });

  it("still counts a date, a deadline or words in brackets, and a long subject before the number", () => {
    assert.equal(withoutReferenceSuffix("共有フォルダの整理（11/14まで）"), "共有フォルダの整理（11/14まで）");
    assert.equal(withoutReferenceSuffix("打ち合わせの日程（10月13日）"), "打ち合わせの日程（10月13日）");
    assert.equal(withoutReferenceSuffix("Budget review (draft)"), "Budget review (draft)");
    const long = "来週の火曜日に予定している会議室の予約サービスの導入に向けた打ち合わせの日程について（案件番号：PJ-1042）";
    assert.equal(subjectFindings(ja, mail(long)).length, 1);
  });
});
