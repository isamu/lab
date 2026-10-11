import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";
import { labelledReferenceNumbers, referenceVariants } from "../packages/chaff/src/reference-numbers.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 同じ予約番号などの、隣り合う文字の入れ違い（reference-number-variant）。番号と例文は自作。

const RULE = "reference-number-variant";

const found = (source: string, adapter: LanguageAdapter, genre = "business/report"): number[] =>
  runRules(buildDocument("booking.md", source, adapter), loadRules(adapter.id), {}, false, genre)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => finding.line);

const messages = (source: string, adapter: LanguageAdapter): string[] => {
  const rules = loadRules(adapter.id);
  const rule = rules.find((definition) => definition.id === RULE);
  assert.ok(rule);
  return runRules(buildDocument("booking.md", source, adapter), rules, {}, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => messageOf(rule, finding, adapter.id));
};

const docJa = (...lines: string[]): string => ["# ご予約の確認", "", ...lines, ""].join("\n");
const docEn = (...lines: string[]): string => ["# Your booking", "", ...lines, ""].join("\n");

describe("reference-number-variant", () => {
  it("ja: 同じ種類の語のすぐ後ろの番号で、隣り合う文字が入れ違ったものを指す", () => {
    assert.deepEqual(found(docJa("予約番号：MN-48215", "", "ご連絡の際は、予約番号 MN-48251 をお伝えください。"), ja), [5]);
    assert.deepEqual(found(docJa("受付番号：K2031", "", "受付番号はK2013です。"), ja), [5]);
    assert.deepEqual(found(docJa("予約確認番号：ＭＮ－４８２１５", "", "予約確認番号 MN-48251"), ja), [5]);
    assert.deepEqual(found(docJa("お問い合わせ番号：TQ-55102", "", "お問合せ番号：TQ-55120"), ja), [5]);
  });

  it("ja: 何度も書いた方を正しいと見て、少ない方を指し、もう一方の番号を示す", () => {
    const source = docJa("予約番号：MN-48251", "", "予約番号：MN-48215", "", "キャンセルには予約番号 MN-48215 が必要です。");
    assert.deepEqual(found(source, ja), [3]);
    assert.deepEqual(messages(source, ja), ["番号「MN-48251」は、「MN-48215」の隣り合う文字が入れ違っています"]);
  });

  it("ja: 同じ番号、種類の違う番号、一文字違い、離れた入れ違い、二か所の入れ違い、語の無い番号は指さない", () => {
    assert.deepEqual(found(docJa("予約番号：MN-48215", "", "予約番号 MN-48215"), ja), []);
    assert.deepEqual(found(docJa("注文番号：MN-48215", "", "予約番号：MN-48251"), ja), []);
    assert.deepEqual(found(docJa("予約番号：MN-48215", "", "受付番号：MN-48251"), ja), []);
    assert.deepEqual(found(docJa("予約番号：MN-48215", "", "予約番号：MN-48216"), ja), []);
    assert.deepEqual(found(docJa("予約番号：MN-48215", "", "予約番号：MN-58214"), ja), []);
    assert.deepEqual(found(docJa("予約番号：MN-48215", "", "予約番号：MN-84251"), ja), []);
    assert.deepEqual(found(docJa("番号 MN-48215", "", "番号 MN-48251"), ja), []);
    assert.deepEqual(found(docJa("予約番号のほかにMN-48215", "", "予約番号のほかにMN-48251"), ja), []);
  });

  it("en: a number right after a booking or reservation label with two neighbouring characters swapped", () => {
    assert.deepEqual(found(docEn("Booking number: LH-48215", "", "When you call, please give your booking number, LH-48251."), en), [5]);
    assert.deepEqual(found(docEn("Reservation number: NF-730514", "", "To cancel, quote reservation number NF-730541."), en), [5]);
    assert.deepEqual(found(docEn("Your confirmation number is 4471-0928.", "", "Confirmation number: 4471-0982"), en), [5]);
    assert.deepEqual(messages(docEn("Booking number: LH-48215", "", "Booking number: LH-48251"), en), [
      "The number LH-48251 is LH-48215 with two neighbouring characters swapped",
    ]);
  });

  it("en: an order number and a booking number, short codes, and more than one swap are not reported", () => {
    assert.deepEqual(found(docEn("Order number: LH-48215", "", "Booking number: LH-48251"), en), []);
    assert.deepEqual(found(docEn("Booking number: LH-48215", "", "Confirmation number: LH-48251"), en), []);
    assert.deepEqual(found(docEn("Booking number: AB-123", "", "Booking number: AB-132"), en), []);
    assert.deepEqual(found(docEn("Booking number: LH-48215", "", "Booking number: HL-48251"), en), []);
    assert.deepEqual(found(docEn("Bring your booking number. 48215 seats remain.", "", "Bring your booking number. 48251 seats remain."), en), []);
    assert.deepEqual(found(docEn("Rebooking numbers: LH-48215", "", "Rebooking numbers: LH-48251"), en), []);
  });

  it("ja: 社員番号・従業員番号の、隣り合う数字の入れ違いを指す", () => {
    assert.deepEqual(found(docJa("社員番号：204817", "", "社員番号204871の源泉徴収票は、1月に交付します。"), ja), [5]);
    assert.deepEqual(found(docJa("従業員番号：P-30562", "", "従業員番号はP-35062です。"), ja), [5]);
  });

  it("ja: 社員番号と予約番号は比べず、上長の番号や表に並んだ二人の番号は指さない", () => {
    assert.deepEqual(found(docJa("社員番号：204817", "", "予約番号：204871"), ja), []);
    assert.deepEqual(found(docJa("社員番号：204817", "", "承認者（社員番号：118305）"), ja), []);
    const roster = ["| 社員番号 | 氏名 |", "| --- | --- |", "| 204817 | 藤井 健太 |", "| 204871 | 佐藤 花子 |"];
    assert.deepEqual(found(docJa(...roster), ja), []);
  });

  it("en: an employee number or employee ID with two neighbouring digits swapped", () => {
    assert.deepEqual(found(docEn("Employee number: 4071-5528", "", "The tax statement for employee number 4071-5582 is issued in January."), en), [5]);
    assert.deepEqual(found(docEn("Employee ID: PT-80213", "", "The statement for employee ID PT-82013 is issued in January."), en), [5]);
    assert.deepEqual(found(docEn("Employee No. 30562", "", "Employee No. 35062"), en), [5]);
  });

  it("en: an employee number is never compared with a booking number, nor with a manager's", () => {
    assert.deepEqual(found(docEn("Employee number: 4071-5528", "", "Booking number: 4071-5582"), en), []);
    assert.deepEqual(found(docEn("Employee number: 4071-5528", "", "Approved by the manager, employee number 3390-1174."), en), []);
    const roster = ["| Employee ID | Name |", "| --- | --- |", "| PT-80213 | Samuel Ortega |", "| PT-82013 | Ana Lima |"];
    assert.deepEqual(found(docEn(...roster), en), []);
  });

  it("reads no number in code or a URL", () => {
    assert.deepEqual(found(docEn("```text", "Booking number: LH-48215", "Booking number: LH-48251", "```"), en), []);
    assert.deepEqual(found(docEn("Booking number: https://example.com/LH-48215", "", "Booking number: https://example.com/LH-48251"), en), []);
  });

  it("does not run in literature", () => {
    assert.deepEqual(found(docJa("予約番号：MN-48215", "", "予約番号：MN-48251"), ja, "literature/fiction"), []);
  });
});

describe("reference numbers", () => {
  const labels = [
    { pattern: "予約番号", group: "booking" },
    { pattern: "受付番号", group: "receipt" },
  ];

  it("reads the letters and digits right after a label, without separators and in half width", () => {
    const numbers = labelledReferenceNumbers("予約番号：ＭＮ－４８２１５\n受付番号 K-2031\n予約番号 A-12", labels);
    assert.deepEqual(
      numbers.map(({ written, characters, label }) => ({ written, characters, label })),
      [
        { written: "ＭＮ－４８２１５", characters: "MN48215", label: "booking" },
        { written: "K-2031", characters: "K2031", label: "receipt" },
      ],
    );
  });

  it("reads nothing without a label, from words between the label and the number, or from empty text", () => {
    assert.deepEqual(labelledReferenceNumbers("", labels), []);
    assert.deepEqual(labelledReferenceNumbers("MN-48215", labels), []);
    assert.deepEqual(labelledReferenceNumbers("予約番号を確認のうえMN-48215", labels), []);
    assert.deepEqual(labelledReferenceNumbers("MN-48215", []), []);
    assert.deepEqual(labelledReferenceNumbers("予約番号をお持ちください。48215席あります。", labels), []);
  });

  it("pairs the later of two equal writings with the earlier, and nothing for no numbers", () => {
    const numbers = labelledReferenceNumbers("予約番号 MN-48215\n予約番号 MN-48251", labels);
    assert.deepEqual(
      referenceVariants(numbers).map(({ number, other }) => [number.written, other.written]),
      [["MN-48251", "MN-48215"]],
    );
    assert.deepEqual(referenceVariants([]), []);
  });
});
