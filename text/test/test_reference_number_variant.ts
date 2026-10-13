import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";
import { followingGroups, labelledReferenceNumbers, referenceVariants } from "../packages/chaff/src/reference-numbers.ts";
import { labelledPlates, plateVariants } from "../packages/chaff/src/vehicle-plates.ts";
import { tableCodes, tableLabelledCodes, unlabelledVariants } from "../packages/chaff/src/unlabelled-references.ts";
import { isSubjectCode, subjectCodeVariants } from "../packages/chaff/src/subject-codes.ts";
import { PatternTimeout } from "../packages/chaff/src/custom/pattern-timeout.ts";
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

  it("ja: 学籍番号・学生番号の、隣り合う文字の入れ違いを指す", () => {
    assert.deepEqual(found(docJa("学籍番号：23K4106", "", "学籍番号23K4160の証明書は、教務課で発行します。"), ja), [5]);
    assert.deepEqual(found(docJa("学生番号：5108327", "", "学生番号は5180327です。"), ja), [5]);
  });

  it("ja: 学籍番号と社員番号は比べず、別の学生の番号は指さない", () => {
    assert.deepEqual(found(docJa("学籍番号：23K4106", "", "社員番号：23K4160"), ja), []);
    assert.deepEqual(found(docJa("学籍番号：23K4106", "", "指導学生（学籍番号：23K5521）"), ja), []);
  });

  it("ja: 発注番号・注文番号の、隣り合う文字の入れ違いを指す", () => {
    assert.deepEqual(found(docJa("発注番号：PO-317520", "", "請求書には発注番号PO-315720をお書きください。"), ja), [5]);
    assert.deepEqual(found(docJa("ご注文番号：88140392", "", "注文番号は88140329です。"), ja), [5]);
  });

  it("ja: 入れ違い一つより多く違う発注番号や、種類の違う番号とは比べない", () => {
    assert.deepEqual(found(docJa("発注番号：PO-317520", "", "前回の発注番号：PO-371250"), ja), []);
    assert.deepEqual(found(docJa("発注番号：PO-317520", "", "受付番号：PO-315720"), ja), []);
  });

  it("en: a student number or student ID with two neighbouring characters swapped", () => {
    assert.deepEqual(found(docEn("Student number: 23K4106", "", "Transcripts for student number 23K4160 are issued by the registry."), en), [5]);
    assert.deepEqual(found(docEn("Student ID: 5108327", "", "Student ID: 5180327"), en), [5]);
    assert.deepEqual(found(docEn("Student No. 5108327", "", "Student No. 5180327"), en), [5]);
  });

  it("en: a student number is never compared with an employee number, nor with another student's", () => {
    assert.deepEqual(found(docEn("Student number: 23K4106", "", "Employee number: 23K4160"), en), []);
    assert.deepEqual(found(docEn("Student number: 23K4106", "", "Supervised student, student number 23K5521."), en), []);
  });

  it("en: a PO or order number with two neighbouring characters swapped", () => {
    assert.deepEqual(found(docEn("PO number: 317520", "", "Please quote PO number 315720 on every invoice."), en), [5]);
    assert.deepEqual(found(docEn("Purchase order number: PO-88140392", "", "Order number: PO-88140329"), en), [5]);
  });

  it("en: two order numbers that differ by more than one swap, or an order and a booking number, are not reported", () => {
    assert.deepEqual(found(docEn("PO number: 317520", "", "Previous PO number: 371250"), en), []);
    assert.deepEqual(found(docEn("Order number: 88140392", "", "Order number: 81840329"), en), []);
    assert.deepEqual(found(docEn("PO number: 317520", "", "Booking number: 315720"), en), []);
  });

  it("reads no number in code or a URL", () => {
    assert.deepEqual(found(docEn("```text", "Booking number: LH-48215", "Booking number: LH-48251", "```"), en), []);
    assert.deepEqual(found(docEn("Booking number: https://example.com/LH-48215", "", "Booking number: https://example.com/LH-48251"), en), []);
  });

  it("does not run in literature", () => {
    assert.deepEqual(found(docJa("予約番号：MN-48215", "", "予約番号：MN-48251"), ja, "literature/fiction"), []);
  });

  it("ja: 請求書番号・インボイス番号と、患者番号・診察券番号の入れ違いを指す", () => {
    assert.deepEqual(found(docJa("インボイス番号：INV-58204", "", "お振込の際は、インボイス番号INV-58024をお書き添えください。"), ja), [5]);
    assert.deepEqual(found(docJa("請求書番号：Q-31842", "", "請求書No. Q-31824"), ja), [5]);
    assert.deepEqual(found(docJa("患者番号：4172093", "", "患者番号4172903の検査結果は、次回お伝えします。"), ja), [5]);
    assert.deepEqual(found(docJa("診察券番号：0038-1265", "", "患者ID：0038-1256"), ja), [5]);
  });

  it("ja: 請求書番号と注文番号、患者番号と請求書番号は比べず、入れ違いより多く違う別の患者の番号は指さない", () => {
    assert.deepEqual(found(docJa("請求書番号：Q-31842", "", "注文番号：Q-31824"), ja), []);
    assert.deepEqual(found(docJa("注文番号：Q-31842", "", "インボイス番号：Q-31824"), ja), []);
    assert.deepEqual(found(docJa("患者番号：4172093", "", "請求書番号：4172903"), ja), []);
    assert.deepEqual(found(docJa("患者番号：4172093（母）", "", "患者番号：4127390（子）"), ja), []);
  });

  it("en: an invoice number or a patient number with two neighbouring characters swapped", () => {
    assert.deepEqual(found(docEn("Invoice No.: KI-40731", "", "Please quote invoice number KI-47031 with your payment."), en), [5]);
    assert.deepEqual(found(docEn("Invoice #KI-40731", "", "Invoice number: KI-40713"), en), [5]);
    assert.deepEqual(found(docEn("Patient number: 7724-3168", "", "Results for patient number 7724-3186 follow."), en), [5]);
    assert.deepEqual(found(docEn("Patient ID: 0038-1265", "", "Patient No. 0038-1256"), en), [5]);
  });

  it("en: an invoice number is never compared with an order number, and two patients' numbers that differ by more than a swap are not reported", () => {
    assert.deepEqual(found(docEn("Invoice number: KI-40731", "", "Order number: KI-47031"), en), []);
    assert.deepEqual(found(docEn("PO number: KI-40731", "", "Invoice No. KI-47031"), en), []);
    assert.deepEqual(found(docEn("Patient number: 7724-3168", "", "Invoice number: 7724-3186"), en), []);
    assert.deepEqual(found(docEn("Patient number: 7724-3168 (mother)", "", "Patient number: 7742-1368 (child)"), en), []);
  });

  it("ja: 見積番号・お見積番号・見積書番号・見積No. の、隣り合う文字の入れ違いを指す", () => {
    assert.deepEqual(found(docJa("見積番号：MT-582046", "", "見積番号MT-580246の内容に変更がある場合は、改めてお見積りします。"), ja), [5]);
    assert.deepEqual(found(docJa("お見積番号：MT-582046", "", "見積書番号はMT-582064です。"), ja), [5]);
    assert.deepEqual(found(docJa("見積No. MT-582046", "", "お見積番号 MT-528046"), ja), [5]);
  });

  it("ja: 見積番号は注文番号・請求書番号と比べない", () => {
    assert.deepEqual(found(docJa("見積番号：MT-582046", "", "注文番号：MT-580246"), ja), []);
    assert.deepEqual(found(docJa("見積番号：MT-582046", "", "請求書番号：MT-580246"), ja), []);
    assert.deepEqual(found(docJa("発注番号：MT-582046", "", "見積No. MT-580246"), ja), []);
  });

  it("en: a quote or estimate number with two neighbouring characters swapped", () => {
    assert.deepEqual(found(docEn("Quote number: RQ-731852", "", "Any change to quote number RQ-731582 is quoted again."), en), [5]);
    assert.deepEqual(found(docEn("Quotation number: RQ-731852", "", "Quote No. RQ-738152"), en), [5]);
    assert.deepEqual(found(docEn("Estimate No.: RQ-731852", "", "The estimate number is RQ-713852."), en), [5]);
    assert.deepEqual(found(docEn("Estimate number: RQ-731852", "", "Quote no RQ-731825"), en), [5]);
  });

  it("en: a quote number is never compared with an order or invoice number, and a bare quote is not a label", () => {
    assert.deepEqual(found(docEn("Quote number: RQ-731852", "", "Order number: RQ-731582"), en), []);
    assert.deepEqual(found(docEn("Invoice number: RQ-731852", "", "Estimate No. RQ-731582"), en), []);
    // A bare "quote" labels nothing; the code after it is still an unlabelled swap of the labelled quote number.
    assert.deepEqual(found(docEn("Quote number: RQ-731852", "", "Any change to quote RQ-731582 is quoted again."), en), [5]);
    assert.deepEqual(found(docEn("Order number: PO-55120", "", "Please quote 731582 when you call."), en), []);
  });

  it("ja: 契約番号・賃貸借契約番号・契約No. の、隣り合う文字の入れ違いを指す", () => {
    assert.deepEqual(found(docJa("契約番号：KR-260417", "", "契約番号KR-260471の更新は、4月1日です。"), ja), [5]);
    assert.deepEqual(found(docJa("賃貸借契約番号：KR-260417", "", "契約番号はKR-206417です。"), ja), [5]);
    assert.deepEqual(found(docJa("契約No. KR-260417", "", "契約番号 KR-260471"), ja), [5]);
  });

  it("ja: 原契約番号・基本契約番号は文書自身の契約番号と比べず、別の契約の番号も指さない", () => {
    assert.deepEqual(found(docJa("契約番号：KR-260417", "", "原契約番号：KR-260471"), ja), []);
    assert.deepEqual(found(docJa("契約番号：KR-260417", "", "基本契約番号はKR-206417です。"), ja), []);
    assert.deepEqual(found(docJa("契約番号：KR-260417", "", "契約番号：KR-264701"), ja), []);
    assert.deepEqual(found(docJa("契約番号：KR-260417", "", "注文番号：KR-260471"), ja), []);
  });

  it("en: a contract or agreement number with two neighbouring characters swapped", () => {
    assert.deepEqual(found(docEn("Tenancy agreement number: TA-260417", "", "Agreement number TA-260471 is due for renewal."), en), [5]);
    assert.deepEqual(found(docEn("Contract number: TA-260417", "", "Please quote contract No. TA-206417."), en), [5]);
  });

  it("en: an original or master agreement's number is not compared with the document's own, nor is another contract's", () => {
    assert.deepEqual(found(docEn("Contract number: TA-260417", "", "Original contract number: TA-260471"), en), []);
    assert.deepEqual(found(docEn("Agreement number: TA-260417", "", "Master agreement number: TA-206417"), en), []);
    assert.deepEqual(found(docEn("Contract number: TA-260417", "", "Contract number: TA-264701"), en), []);
    assert.deepEqual(found(docEn("Contract number: TA-260417", "", "Invoice number: TA-260471"), en), []);
  });

  it("ja: 旧契約番号・変更契約番号・親契約番号は文書自身の契約番号と比べない", () => {
    assert.deepEqual(found(docJa("契約番号：KR-260417", "", "旧契約番号：KR-260471"), ja), []);
    assert.deepEqual(found(docJa("契約番号：KR-260417", "旧契約番号：KR-260471"), ja), []);
    assert.deepEqual(found(docJa("契約番号：KR-260417", "", "変更契約番号はKR-206417です。"), ja), []);
    assert.deepEqual(found(docJa("契約番号：KR-260417", "", "親契約番号 KR-260147"), ja), []);
  });

  it("ja: 旧契約番号どうし、変更契約番号どうしの入れ違いは指す", () => {
    assert.deepEqual(found(docJa("旧契約番号：KR-250417", "", "旧契約番号KR-250471の契約は終了します。"), ja), [5]);
    assert.deepEqual(found(docJa("変更契約番号：KR-260417", "", "変更契約番号はKR-206417です。"), ja), [5]);
    assert.deepEqual(found(docJa("親契約番号：KR-190417", "", "親契約番号 KR-190471"), ja), [5]);
  });

  it("en: a former, amended or parent contract's number is not compared with the document's own", () => {
    assert.deepEqual(found(docEn("Contract number: TA-260417", "", "Former contract number: TA-260471"), en), []);
    assert.deepEqual(found(docEn("Contract number: TA-260417", "", "Amended contract number: TA-206417"), en), []);
    assert.deepEqual(found(docEn("Contract number: TA-260417", "", "Amendment number: TA-260471"), en), []);
    assert.deepEqual(found(docEn("Agreement number: TA-260417", "", "Parent agreement number: TA-260471"), en), []);
    assert.deepEqual(found(docEn("Contract number: TA-260417", "", "Parent contract number: TA-260147"), en), []);
  });

  it("ja: 会員番号・会員ID と、空白で区切って書いた会員番号の入れ違いを指す", () => {
    assert.deepEqual(found(docJa("会員番号：MD-30418-72", "", "お問い合わせの際は、会員番号（MD-30481-72）をお知らせください。"), ja), [5]);
    assert.deepEqual(found(docJa("会員ID：KT20573", "", "会員IDはKT20753です。"), ja), [5]);
    assert.deepEqual(found(docJa("会員番号：HM 5520 8137", "", "お問い合わせの際は、会員番号 HM 5520 8173 をお知らせください。"), ja), [5]);
    assert.deepEqual(found(docJa("会員番号：5520 8137", "", "会員番号 5520 8173 の方は窓口へ。"), ja), [5]);
  });

  it("ja: 会員番号とお客様番号は比べず、空白の後ろの語や回数は番号に含めない", () => {
    assert.deepEqual(found(docJa("会員番号：HM-55208", "", "お客様番号：HM-55280"), ja), []);
    assert.deepEqual(found(docJa("会員番号：HM 5520 8137", "", "会員番号 HM 5520 8137 の方"), ja), []);
    assert.deepEqual(found(docJa("会員番号 1234 様", "", "会員番号 1243 様"), ja), [5]);
    assert.deepEqual(found(docJa("会員番号 4821 2名様", "", "会員番号 4821 3名様"), ja), []);
  });

  it("en: a member or membership number, and one written in spaced groups, with two neighbours swapped", () => {
    assert.deepEqual(found(docEn("Member number: MD-30418-72", "", "Please give your member number (MD-30481-72)."), en), [5]);
    assert.deepEqual(found(docEn("Membership number: HM 5520 8137", "", "Please give your member number HM 5520 8173."), en), [5]);
    assert.deepEqual(found(docEn("Member ID: 5520 8137", "", "Member number 5520 8173 expires in May."), en), [5]);
    assert.deepEqual(found(docEn("Member No 48215", "", "Member No. 48251"), en), [5]);
  });

  it("en: a member number is not compared with a customer number, and a word after the groups is not read", () => {
    assert.deepEqual(found(docEn("Member number: HM-55208", "", "Customer number: HM-55280"), en), []);
    assert.deepEqual(found(docEn("Member number: 5520 8137", "", "Member number 5520 8137 expires in May."), en), []);
    assert.deepEqual(found(docEn("Member number 4821 2nd copy", "", "Member number 4821 3rd copy"), en), []);
  });

  it("en: two writings of one former or parent contract's number with neighbours swapped are reported", () => {
    assert.deepEqual(found(docEn("Former contract number: TA-250417", "", "Former contract number TA-250471 has ended."), en), [5]);
    assert.deepEqual(found(docEn("Parent agreement number: TA-190417", "", "Parent agreement number: TA-190471"), en), [5]);
  });

  it("ja: 登録番号・受講番号、申込番号の、隣り合う文字の入れ違いを指す", () => {
    assert.deepEqual(found(docJa("登録番号：RF-62417", "", "お問い合わせの際は、登録番号RF-62147をお知らせください。"), ja), [5]);
    assert.deepEqual(found(docJa("受講番号：RF-62417", "", "受講番号はRF-64217です。"), ja), [5]);
    assert.deepEqual(found(docJa("申込番号：AP-30518", "", "申込番号 AP-30581"), ja), [5]);
  });

  it("ja: 申込番号と登録番号、登録番号と受付番号は比べず、別の人の登録番号は指さない", () => {
    assert.deepEqual(found(docJa("申込番号：RF-62417", "", "登録番号：RF-62147"), ja), []);
    assert.deepEqual(found(docJa("受付番号：RF-62417", "", "登録番号：RF-62147"), ja), []);
    assert.deepEqual(found(docJa("登録番号：RF-62417", "", "登録番号：RF-61724"), ja), []);
  });

  it("en: a registration or application number with two neighbouring characters swapped", () => {
    assert.deepEqual(found(docEn("Registration number: RF-62417", "", "Please quote registration number RF-62147 in any inquiry."), en), [5]);
    assert.deepEqual(found(docEn("Registration No. RF-62417", "", "Registration number: RF-64217"), en), [5]);
    assert.deepEqual(found(docEn("Application number: AP-30518", "", "Your application number is AP-30581."), en), [5]);
  });

  it("en: an application number is not compared with a registration number, nor a registration number with a booking number", () => {
    assert.deepEqual(found(docEn("Application number: RF-62417", "", "Registration number: RF-62147"), en), []);
    assert.deepEqual(found(docEn("Booking number: RF-62417", "", "Registration number: RF-62147"), en), []);
    assert.deepEqual(found(docEn("Registration number: RF-62417", "", "Registration number: RF-61724"), en), []);
  });

  it("ja: 口座番号・口座No. と、証券番号・保険証券番号の、隣り合う数字の入れ違いを指す", () => {
    assert.deepEqual(found(docJa("口座番号：4816203", "", "お振込みには、口座番号 4812603 をお伝えください。"), ja), [5]);
    assert.deepEqual(found(docJa("口座No.：4816203", "", "口座番号は4816230です。"), ja), [5]);
    assert.deepEqual(found(docJa("証券番号：57-3029184", "", "証券番号57-3092184のご契約は、引き続き有効です。"), ja), [5]);
    assert.deepEqual(found(docJa("保険証券番号：57-3029184", "", "証券番号 57-3029148"), ja), [5]);
  });

  it("ja: 振込先・振込元の口座番号は口座自身の番号と比べず、口座番号と証券番号・契約番号も比べない", () => {
    assert.deepEqual(found(docJa("口座番号：4816203", "", "| 9月5日 | 振込 振込先口座番号 4812603 | 30,000円 |"), ja), []);
    assert.deepEqual(found(docJa("口座番号：4816203", "", "振込先の口座番号は4812603です。"), ja), []);
    assert.deepEqual(found(docJa("口座番号：4816203", "", "振込元口座番号：4812603"), ja), []);
    assert.deepEqual(found(docJa("口座番号：57-3029184", "", "証券番号：57-3092184"), ja), []);
    assert.deepEqual(found(docJa("契約番号：57-3029184", "", "証券番号：57-3092184"), ja), []);
    assert.deepEqual(found(docJa("契約者番号：57-3029184", "", "契約者番号：57-3092184"), ja), []);
  });

  it("ja: 振込先口座番号どうしの入れ違いは指す", () => {
    assert.deepEqual(found(docJa("振込先口座番号：4816203", "", "振込先口座番号は4812603です。"), ja), [5]);
  });

  it("en: an account number or a policy number with two neighbouring digits swapped", () => {
    assert.deepEqual(found(docEn("Account number: 60418273", "", "Give the payer the account number 60412873."), en), [5]);
    assert.deepEqual(found(docEn("Account No. 60418273", "", "Your account number is 60418237."), en), [5]);
    assert.deepEqual(found(docEn("Policy number: HL-4820-1937", "", "The cover under policy number HL-4820-1973 continues."), en), [5]);
    assert.deepEqual(found(docEn("Insurance policy number: HL-4820-1937", "", "Policy No. HL-4802-1937"), en), [5]);
  });

  it("en: a payee's or payer's account is not compared with the account's own, nor an account number with a policy or contract number", () => {
    assert.deepEqual(found(docEn("Account number: 60418273", "", "| Sep 5 | Transfer, payee account number 60412873 | $300.00 |"), en), []);
    assert.deepEqual(found(docEn("Account number: 60418273", "", "Beneficiary's account number: 60412873"), en), []);
    assert.deepEqual(found(docEn("Account number: 60418273", "", "Sender account number: 60412873"), en), []);
    assert.deepEqual(found(docEn("Account number: HL-4820-1937", "", "Policy number: HL-4820-1973"), en), []);
    assert.deepEqual(found(docEn("Contract number: HL-4820-1937", "", "Policy number: HL-4820-1973"), en), []);
    assert.deepEqual(found(docEn("Policyholder number: HL-4820-1937", "", "Policyholder number: HL-4820-1973"), en), []);
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

  it("reads a number in groups one space apart as one, up to the line's end or a word that is not a code", () => {
    const read = (text: string): string[] => labelledReferenceNumbers(text, labels).map(({ written }) => written);
    assert.deepEqual(read("予約番号 HM 5520 8137 の方"), ["HM 5520 8137"]);
    assert.deepEqual(read("予約番号 HM 5520 8137をお知らせ"), ["HM 5520 8137"]);
    assert.deepEqual(read("予約番号 5520 8137\n4410 様"), ["5520 8137"]);
    assert.deepEqual(read("予約番号 1234 様"), ["1234"]);
    assert.deepEqual(read("予約番号 4821 2名"), ["4821"]);
    assert.deepEqual(read("予約番号 4821 2026年"), ["4821"]);
    assert.deepEqual(read("予約番号 4821 ABC"), ["4821"]);
    assert.deepEqual(read("予約番号 4821 2nd"), ["4821"]);
    assert.deepEqual(read("予約番号 4821 100 copies"), ["4821"]);
    assert.deepEqual(read("予約番号 4821 080 1234 5678"), ["4821"]);
    assert.deepEqual(read("予約番号 4821  5520"), ["4821"]);
    assert.deepEqual(read("予約番号 MN-4821 5520"), ["MN-4821"]);
    assert.deepEqual(read("予約番号 Mn 4821 5520"), []);
    assert.deepEqual(read("予約番号 HM 12"), []);
    assert.deepEqual(read("予約番号 ＨＭ ５５２０ ８１３７"), ["ＨＭ ５５２０ ８１３７"]);
  });

  it("reads a number in groups as its characters without the spaces, and never past the longest number", () => {
    assert.deepEqual(labelledReferenceNumbers("予約番号 HM 5520 8137", labels)[0]?.characters, "HM55208137");
    assert.deepEqual(labelledReferenceNumbers(`予約番号 ${Array.from({ length: 8 }, () => "1234").join(" ")}`, labels), []);
    assert.equal(followingGroups("HM 5520 8137", 2, "HM"), " 5520 8137");
    assert.equal(followingGroups("No 5520 8137", 2, "No"), "");
    assert.equal(followingGroups("HM", 2, "HM"), "");
    const runOn = `HM${" 1234".repeat(20000)}`;
    assert.ok(followingGroups(runOn, 2, "HM").length < runOn.length);
    assert.deepEqual(labelledReferenceNumbers(`予約番号 ${runOn}`, labels), []);
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

describe("reference-number-variant: vehicle plates", () => {
  const docCar = (...lines: string[]): string => ["# 整備記録簿", "", ...lines, ""].join("\n");
  const docVehicle = (...lines: string[]): string => ["# Service record", "", ...lines, ""].join("\n");

  it("ja: 文書の車のナンバーを、一連番号の一文字だけ違えて書いた所を指す", () => {
    const source = docCar("登録番号：ひばり野 330 ね 48-15", "", "登録番号ひばり野 330 ね 48-75 のお車は、午前9時までにご入庫ください。");
    assert.deepEqual(found(source, ja), [5]);
    assert.deepEqual(messages(source, ja), [
      "ナンバー「ひばり野 330 ね 48-75」は、この文書の車のナンバー「ひばり野 330 ね 48-15」と一連番号の一文字だけが違います",
    ]);
    assert.deepEqual(found(docCar("自動車登録番号：かえで台 500 み 72-06", "", "自動車登録番号 かえで台 500 み 72-08 の記録は2年間保管します。"), ja), [5]);
    assert.deepEqual(found(docCar("車両番号：かえで台 500 み ・・12", "", "車両番号かえで台 500 み ・・13 の車検は来月です。"), ja), [5]);
  });

  it("ja: ナンバーの隣り合う文字の入れ違いも指す", () => {
    assert.deepEqual(found(docCar("登録番号：ひばり野 330 ね 48-15", "", "登録番号 ひばり野 330 ね 48-51"), ja), [5]);
  });

  it("ja: 二台の車、地名・分類番号・かなの違い、二文字違い、三つ目のナンバー、見出し行の無い文書は一文字違いとして指さない", () => {
    assert.deepEqual(found(docCar("登録番号：ひばり野 330 ね 48-15", "", "登録番号：ひばり野 330 ね 48-75"), ja), []);
    assert.deepEqual(found(docCar("登録番号ひばり野 330 ね 48-15 のお車", "", "登録番号ひばり野 330 ね 48-75 のお車"), ja), []);
    assert.deepEqual(found(docCar("登録番号：ひばり野 330 ね 48-15", "", "登録番号 かえで台 330 ね 48-75"), ja), []);
    assert.deepEqual(found(docCar("登録番号：ひばり野 330 ね 48-15", "", "登録番号 ひばり野 300 ね 48-75"), ja), []);
    assert.deepEqual(found(docCar("登録番号：ひばり野 330 ね 48-15", "", "登録番号 ひばり野 330 み 48-15"), ja), []);
    assert.deepEqual(found(docCar("登録番号：ひばり野 330 ね 48-15", "", "登録番号 ひばり野 330 ね 47-75"), ja), []);
    assert.deepEqual(found(docCar("登録番号：ひばり野 330 ね 48-15", "", "登録番号 ひばり野 330 ね 48-75", "", "代車 登録番号 ひばり野 330 ね 48-16"), ja), []);
    assert.deepEqual(found(docCar("登録番号：ひばり野 330 ね 48-15", "", "代車の登録番号ひばり野 330 ね 48-75 のお車をお貸しします。"), ja), []);
    assert.deepEqual(found(docCar("登録番号：ひばり野 330 ね 48-15", "", "作業中は、代車として登録番号ひばり野 330 ね 48-75 のお車をお貸しします。"), ja), []);
  });

  it("ja: ナンバーの形でない登録番号や車両番号は、一文字違いでも指さない", () => {
    assert.deepEqual(found(docJa("登録番号：RF-62417", "", "登録番号 RF-62418"), ja), []);
    assert.deepEqual(found(docJa("車両番号：RF-62417", "", "車両番号 RF-62418"), ja), []);
    assert.deepEqual(found(docJa("車両番号：RF-62417", "", "登録番号：RF-62147"), ja), []);
  });

  it("en: a plate number with two neighbouring characters swapped, never one character changed nor compared with a registration number", () => {
    assert.deepEqual(found(docVehicle("Number plate: KX-48215", "", "The car with number plate KX-48251 is ready."), en), [5]);
    assert.deepEqual(found(docVehicle("Licence plate: KX-48215", "", "Licence plate KX-48275"), en), []);
    assert.deepEqual(found(docVehicle("Registration number: KX-48215", "", "Number plate: KX-48251"), en), []);
  });
});

describe("vehicle plates", () => {
  const labels = [{ pattern: "登録番号", group: "registration" }];
  const shape = { pattern: String.raw`(?<region>[\p{Script=Han}ぁ-ゖ]{1,5}) ?(?<class>\d{1,3}) ?(?<kana>[ぁ-ゖ]) ?(?<serial>\d{1,2}-\d{2})`, group: "vehicle" };

  it("reads a plate right after a label in the shape's group, its serial apart, and whether its line is a field", () => {
    const plates = labelledPlates("登録番号：ひばり野 330 ね 48-15\n登録番号ひばり野 330 ね 48-75 のお車", labels, [shape]);
    assert.deepEqual(
      plates.map(({ written, characters, label, serial, opensSentence, onField }) => ({ written, characters, label, serial, opensSentence, onField })),
      [
        { written: "ひばり野 330 ね 48-15", characters: "ひばり野330ね4815", label: "vehicle", serial: "4815", opensSentence: true, onField: true },
        { written: "ひばり野 330 ね 48-75", characters: "ひばり野330ね4875", label: "vehicle", serial: "4875", opensSentence: true, onField: false },
      ],
    );
    assert.deepEqual(
      plateVariants(plates).map(({ number, other }) => [number.written, other.written]),
      [["ひばり野 330 ね 48-75", "ひばり野 330 ね 48-15"]],
    );
  });

  it("reads nothing from empty text, no shapes, a shape that is not an expression or has no serial, a plate run on into digits, or no label", () => {
    assert.deepEqual(labelledPlates("", labels, [shape]), []);
    assert.deepEqual(labelledPlates("登録番号：ひばり野 330 ね 48-15", labels, []), []);
    assert.deepEqual(labelledPlates("登録番号：ひばり野 330 ね 48-15", labels, [{ pattern: "(", group: "vehicle" }]), []);
    assert.deepEqual(labelledPlates("登録番号：ひばり野 330 ね 48-15", labels, [{ pattern: String.raw`(?<region>\S+) \d+`, group: "vehicle" }]), []);
    assert.deepEqual(labelledPlates("登録番号：ひばり野 330 ね 48-159", labels, [shape]), []);
    assert.deepEqual(labelledPlates("ひばり野 330 ね 48-15", labels, [shape]), []);
    assert.deepEqual(plateVariants([]), []);
  });

  it("reads a word before the label as not opening the sentence, and stops a shape that runs away", () => {
    const [plate] = labelledPlates("お預かりした車（登録番号ひばり野 330 ね 48-15）", labels, [shape]);
    assert.equal(plate?.opensSentence, false);
    assert.equal(labelledPlates("点検は済みました。登録番号ひばり野 330 ね 48-15 のお車", labels, [shape])[0]?.opensSentence, true);
    assert.throws(() => labelledPlates(`登録番号 ${"a".repeat(40)}!`, labels, [{ pattern: "(?<serial>(a+)+)$", group: "vehicle" }]), PatternTimeout);
  });
});

describe("reference-number-variant: an item code labelled once and written with no label", () => {
  const catalogJa = (...lines: string[]): string => ["# 文具カタログ", "", ...lines, ""].join("\n");
  const catalogEn = (...lines: string[]): string => ["# Stationery catalog", "", ...lines, ""].join("\n");
  const specJa = ["| 項目 | 内容 |", "| --- | --- |", "| 品番 | GP-0512 |", "| 全長 | 142mm |"];
  const specEn = ["| Item | Detail |", "| --- | --- |", "| Item code | GP-0512 |", "| Length | 142 mm |"];
  const listJa = (...codes: string[]): string[] => ["| 品番 | 品名 |", "| --- | --- |", ...codes.map((code) => `| ${code} | ボールペン |`)];
  const listEn = (...codes: string[]): string[] => ["| Item code | Description |", "| --- | --- |", ...codes.map((code) => `| ${code} | Gel pen |`)];

  it("ja: 表や語の後ろの品番と、語の無い品番の隣り合う文字の入れ違いを指す", () => {
    assert.deepEqual(found(catalogJa(...specJa, "", "GP-0521の替芯は13ページに載せています。"), ja), [8]);
    assert.deepEqual(found(catalogJa(...listJa("GP-0512", "NB-5830"), "", "GP-0521の替芯は13ページに載せています。"), ja), [8]);
    assert.deepEqual(found(catalogJa("品番：GP-0512", "", "GP-0521の替芯は13ページに載せています。"), ja), [5]);
    assert.deepEqual(found(catalogJa("商品コード：GP-0512", "", "替芯はGP-0521用です。"), ja), [5]);
    assert.deepEqual(messages(catalogJa("品番：GP-0512", "", "GP-0521の替芯"), ja), ["番号「GP-0521」は、「GP-0512」の隣り合う文字が入れ違っています"]);
  });

  it("ja: 表に並ぶ別の商品、語の後ろにある品番、二つの品番のどちらとも読める品番、記号の無い番号は指さない", () => {
    assert.deepEqual(found(catalogJa(...listJa("AB-1234", "AB-1243"), "", "AB-1243の替芯は13ページです。"), ja), []);
    assert.deepEqual(found(catalogJa(...listJa("AB-1234"), "", "品番：AB-1243", "", "AB-1243の替芯は13ページです。"), ja), []);
    assert.deepEqual(found(catalogJa(...listJa("AB-1234", "AB-1342"), "", "AB-1324の替芯は13ページです。"), ja), []);
    assert.deepEqual(found(catalogJa("予約番号：48215", "", "48251をお伝えください。"), ja), []);
    assert.deepEqual(found(catalogJa("品番：GP-0512", "", "GP0521の替芯"), ja), []);
    assert.deepEqual(found(catalogJa("GP-0512のボールペン", "", "GP-0521の替芯"), ja), []);
    assert.deepEqual(found(catalogJa(...specJa, "", "GP-0512の替芯は13ページに載せています。"), ja), []);
    assert.deepEqual(found(catalogJa("品番：AB-1234", "", "品番：AB-1243"), ja), []);
  });

  it("en: a code with no label that is a labelled code with two neighbours swapped", () => {
    assert.deepEqual(found(catalogEn(...specEn, "", "Refills for GP-0521 are on page 13."), en), [8]);
    assert.deepEqual(found(catalogEn(...listEn("GP-0512", "NB-5830"), "", "Refills for GP-0521 are on page 13."), en), [8]);
    assert.deepEqual(found(catalogEn("SKU: GP-0512", "", "Refills for GP-0521 are on page 13."), en), [5]);
    assert.deepEqual(found(catalogEn("Product code: GP-0512", "", "Refills for GP-0521 are on page 13."), en), [5]);
  });

  it("en: not two items a table lists, a labelled code, a code two labelled codes swap to, nor a plain number", () => {
    assert.deepEqual(found(catalogEn(...listEn("AB-1234", "AB-1243"), "", "Refills for AB-1243 are on page 13."), en), []);
    assert.deepEqual(found(catalogEn(...listEn("AB-1234", "AB-1342"), "", "Refills for AB-1324 are on page 13."), en), []);
    assert.deepEqual(found(catalogEn("Booking number: 48215", "", "Please quote 48251."), en), []);
    assert.deepEqual(found(catalogEn("GP-0512 gel pen", "", "Refills for GP-0521"), en), []);
    assert.deepEqual(found(catalogEn("Item code: AB-1234", "", "Item code: AB-1243"), en), []);
    assert.deepEqual(
      found(catalogEn("Item code: AB-1234", "", "| AB-1243 | Name |", "| --- | --- |", "| refill | pen |", "", "Use the AB-1243 refill."), en),
      [],
    );
  });

  it("reads codes a table labels by row and by column, and every code a table lists", () => {
    const labels = [{ pattern: "品番", group: "item" }];
    const text = [
      "| 品番 | GP-0512 |",
      "| --- | --- |",
      "| 品番 | NB-5830 |",
      "",
      "| 品番 | 品名 |",
      "| --- | --- |",
      "| CL-2804 | クリップ |",
      "| 2026-118 | 封筒 |",
      "",
    ].join("\n");
    assert.deepEqual(
      tableLabelledCodes(text, labels).map(({ written, characters, label }) => [written, characters, label]),
      [
        ["NB-5830", "NB5830", "item"],
        ["CL-2804", "CL2804", "item"],
      ],
    );
    assert.deepEqual([...tableCodes(text)], ["GP0512", "NB5830", "CL2804"]);
    assert.deepEqual(tableLabelledCodes("", labels), []);
    assert.deepEqual(tableLabelledCodes(text, []), []);
  });

  it("matches an unlabelled code only to exactly one labelled code it is not itself", () => {
    const anchor = { offset: 0, written: "GP-0512", characters: "GP0512", label: "item" };
    assert.deepEqual(
      unlabelledVariants("GP-0512 x GP-0521", [anchor], new Set()).map(({ number, other }) => [number.written, number.offset, other.written]),
      [["GP-0521", 10, "GP-0512"]],
    );
    assert.deepEqual(unlabelledVariants("GP-0521", [anchor], new Set(["GP0521"])), []);
    assert.deepEqual(unlabelledVariants("GP-0521", [], new Set()), []);
    assert.deepEqual(unlabelledVariants("", [anchor], new Set()), []);
    assert.deepEqual(unlabelledVariants("https://example.com/GP-0521", [anchor], new Set()), []);
    assert.deepEqual(unlabelledVariants("12-0521", [{ ...anchor, written: "12-0512", characters: "120512" }], new Set()), []);
  });
});

describe("reference-number-variant: the one model a product document is about", () => {
  const notice = (title: string, ...lines: string[]): string => [`# ${title}`, "", ...lines, ""].join("\n");
  const specJa = (code: string): string[] => ["| 項目 | 内容 |", "| --- | --- |", "| 品名 | 電子レンジ |", `| 型番 | ${code} |`];
  const specEn = (code: string): string[] => ["| Item | Details |", "| --- | --- |", "| Product | Microwave oven |", `| Model | ${code} |`];

  it("ja: 題名や型番の行・表の型番と、一度だけ書いた隣り合う文字の入れ違いを指す", () => {
    assert.deepEqual(found(notice("ストーブ回収のお知らせ", "型番：NH-805", "", "NH-850 をお使いの方は使用をやめてください。"), ja), [5]);
    assert.deepEqual(found(notice("イヤホン SB-210 保証規定", "本製品の型番 SB-201 が読めないときは保証しません。"), ja), [3]);
    assert.deepEqual(found(notice("電子レンジ 保証書", ...specJa("KR-M230"), "", "型番 KR-M320 の本体が故障したときは修理します。"), ja), [8]);
    assert.deepEqual(found(notice("パン回収のお知らせ", "商品コード：KB-120", "", "KB-210 の商品はお送りください。"), ja), [5]);
    assert.deepEqual(messages(notice("ストーブ回収のお知らせ", "型番：NH-805", "", "NH-850 をお使いの方へ"), ja), [
      "番号「NH-850」は、「NH-805」の隣り合う文字が入れ違っています",
    ]);
  });

  it("ja: 二つの型番を名指す文書、表に並ぶ型番、二度書いた型番、同じ行の並び、英字一つの番号、別の種類の語の番号は指さない", () => {
    assert.deepEqual(found(notice("回収のお知らせ", "型番：NH-805", "", "型番：NH-850", "", "NH-850 をお使いの方へ"), ja), []);
    assert.deepEqual(found(notice("NH-805 回収のお知らせ", "型番：NH-900", "", "NH-850 をお使いの方へ"), ja), []);
    assert.deepEqual(found(notice("NH-805 回収のお知らせ", "| 対象 |", "| --- |", "| NH-850 |", "", "NH-850 をお使いの方へ"), ja), []);
    assert.deepEqual(found(notice("NH-805 回収のお知らせ", "", "NH-850 をお使いの方へ。NH-850 は交換します。"), ja), []);
    assert.deepEqual(found(notice("NH-805 回収のお知らせ", "", "対象は NH-805 と NH-850 です。"), ja), []);
    assert.deepEqual(found(notice("申請書 A-12 の書き方", "", "A-21 は別の様式です。"), ja), []);
    assert.deepEqual(found(notice("NH-805 回収のお知らせ", "", "予約番号 NH-850 をお伝えください。"), ja), []);
    assert.deepEqual(found(notice("ストーブ回収のお知らせ", "型番：NH-805", "", "NH-805 をお使いの方へ"), ja), []);
  });

  it("en: a model written once with two neighbours swapped from the title's, a field's or a table's", () => {
    assert.deepEqual(found(notice("Recall: SH-710 Space Heater", "Model: SH-710", "", "If you own an SH-701, stop using it."), en), [5]);
    assert.deepEqual(found(notice("Limited Warranty: Tracker FT-38", "(a) The model number FT-83 cannot be read."), en), [3]);
    assert.deepEqual(found(notice("Warranty Card", ...specEn("MW-4120S"), "", "If the MW-4210S fails, we repair it."), en), [8]);
    assert.deepEqual(found(notice("Granola Recall", "Item code: GB-240", "", "If you have GB-204 bars, do not eat them."), en), [5]);
  });

  it("en: not two models a document names, a table's own models, nor a code on the model's line", () => {
    assert.deepEqual(
      found(notice("Catalog", "| Model | Price |", "| --- | --- |", "| AB-1234 | $20 |", "| AB-1243 | $25 |", "", "The AB-1243 is new."), en),
      [],
    );
    assert.deepEqual(found(notice("Recall", "Model: AB-3412", "", "Model: AB-3142", "", "The AB-3142 is affected."), en), []);
    assert.deepEqual(found(notice("Recall: SH-710 and SH-701", "", "Owners of the SH-701 should call us."), en), []);
    assert.deepEqual(found(notice("Recall: SH-710", "", "The SH-710 replaces the SH-701."), en), []);
    assert.deepEqual(found(notice("Form A-12", "", "Form A-21 is another form."), en), []);
  });

  it("reads a short code only with two letters, a hyphen and two digits", () => {
    assert.equal(isSubjectCode("FT-38"), true);
    assert.equal(isSubjectCode("KR-M230"), true);
    assert.equal(isSubjectCode("A-12"), false);
    assert.equal(isSubjectCode("A-12B"), false);
    assert.equal(isSubjectCode("１２-AB34"), false);
    assert.equal(isSubjectCode("FT-3"), false);
    assert.equal(isSubjectCode("FT38"), false);
    assert.equal(isSubjectCode(""), false);
  });

  it("matches a writing to the document's code only when exactly one code is named", () => {
    const base = { labels: [{ pattern: "型番", group: "model" }], listed: new Set(["model"]), tabled: [], known: new Set<string>() };
    const variants = (prose: string, title?: string): string[] =>
      subjectCodeVariants({ ...base, prose, title: title === undefined ? undefined : { start: 0, text: title } }).map(
        ({ number, other }) => `${number.written}<${other.written}`,
      );
    assert.deepEqual(variants("\n\n型番：NH-805\n\nNH-850 の方へ"), ["NH-850<NH-805"]);
    assert.deepEqual(variants("# NH-805\n\nNH-850 の方へ", "# NH-805"), ["NH-850<NH-805"]);
    assert.deepEqual(variants("NH-850 の方へ"), []);
    assert.deepEqual(variants(""), []);
    assert.deepEqual(variants("# NH-805 / NH-900\n\nNH-850 の方へ", "# NH-805 / NH-900"), []);
    assert.deepEqual(variants("# NH-805\n\nhttps://example.com/NH-850", "# NH-805"), []);
    assert.deepEqual(
      subjectCodeVariants({ ...base, prose: "# NH-805\n\nNH-850 の方へ", title: { start: 0, text: "# NH-805" }, known: new Set(["NH850"]) }),
      [],
    );
  });
});
