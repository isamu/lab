import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { labelledPhoneNumbers, phoneVariants, swapsNeighbours } from "../packages/chaff/src/phone-numbers.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 同じ電話番号の、隣り合う数字の入れ違い（phone-number-variant）。番号と例文は自作。

const RULE = "phone-number-variant";

const found = (source: string, adapter: LanguageAdapter, genre = "business/report"): number[] =>
  runRules(buildDocument("notice.md", source, adapter), loadRules(adapter.id), {}, false, genre)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => finding.line);

const doc = (...lines: string[]): string => ["# お知らせ", "", ...lines, ""].join("\n");

describe("phone-number-variant", () => {
  it("ja: 同じ種類の語の後ろの番号で、隣り合う数字が入れ違ったものを指す", () => {
    assert.deepEqual(found(doc("申込先　電話：0120-123-456", "", "問合せ先　電話：0120-123-465"), ja), [5]);
    assert.deepEqual(found(doc("電話：045-123-4567", "", "電話でのお問合せは、045-123-4576へおかけください。"), ja), [5]);
    assert.deepEqual(found(doc("TEL 03（1234）5678", "", "電話 03-1234-5687"), ja), [5]);
  });

  it("ja: 何度も書いた方を正しいと見て、少ない方を指す", () => {
    assert.deepEqual(found(doc("電話：0120-123-465", "", "電話：0120-123-456", "", "電話：0120-123-456"), ja), [3]);
  });

  it("ja: 同じ番号、種類の違う番号、一桁違い、語の無い番号は指さない", () => {
    assert.deepEqual(found(doc("電話：0120-123-456", "", "電話：0120-123-456"), ja), []);
    assert.deepEqual(found(doc("電話：03-1234-5678　FAX：03-1234-5687"), ja), []);
    assert.deepEqual(found(doc("代表：03-1234-5678", "", "直通：03-1234-5679"), ja), []);
    assert.deepEqual(found(doc("番号 0120-123-456", "", "番号 0120-123-465"), ja), []);
    assert.deepEqual(found(doc("電話：0120-123-456", "", "電話：0120-123-654"), ja), []);
  });

  it("en: a number after phone or call with two neighbouring digits swapped", () => {
    const en1 = (...lines: string[]): string => ["# Notice", "", ...lines, ""].join("\n");
    assert.deepEqual(found(en1("Phone: 045-123-4567", "", "For questions by phone, call 045-123-4576."), en), [5]);
    assert.deepEqual(found(en1("Phone: (555) 123-4567", "", "Phone: (555) 123-4657"), en), [5]);
    assert.deepEqual(found(en1("Phone: 045-123-4567 Fax: 045-123-4576"), en), []);
    assert.deepEqual(found(en1("Hotel 045-123-4567", "", "Hotel 045-123-4576"), en), []);
  });

  it("reports each writing of one side of a tie once, not both sides", () => {
    const en1 = (...lines: string[]): string => ["# Notice", "", ...lines, ""].join("\n");
    assert.deepEqual(found(en1("Phone: 0120-123-456", "", "Phone: 0120-123-465", "", "Phone: 0120-123-456", "", "Phone: 0120-123-465"), en), [5, 9]);
  });

  it("reads a compound label as its own kind, and no number in code, a URL or far from its label", () => {
    const en1 = (...lines: string[]): string => ["# Notice", "", ...lines, ""].join("\n");
    assert.deepEqual(found(doc("携帯：090-1234-5678", "", "携帯電話：090-1234-5687"), ja), [5]);
    assert.deepEqual(found(doc("電話：090-1234-5678", "", "携帯電話：090-1234-5687"), ja), []);
    assert.deepEqual(found(en1("```text", "Phone: 0120-123-456", "Phone: 0120-123-465", "```"), en), []);
    assert.deepEqual(found(en1("See https://example.com/call/1234-5678-90", "", "and https://example.com/call/1234-5678-09"), en), []);
    assert.deepEqual(found(en1("Phone support is described above; document numbers are 1234-5678-90 and 1234-5678-09."), en), []);
  });

  it("does not run in literature", () => {
    assert.deepEqual(found(doc("電話：0120-123-456", "", "電話：0120-123-465"), ja, "literature/fiction"), []);
  });
});

describe("phone numbers", () => {
  const labels = [
    { pattern: "電話", group: "phone" },
    { pattern: "FAX", group: "fax" },
  ];

  it("reads labelled numbers of 9 to 13 digits, not dates, amounts or postal codes", () => {
    const text = "電話：03-1234-5678\n電話 2026-10-05\n電話 1,234,567,890\n電話 〒123-4567\nFAX 03-1234-5679";
    assert.deepEqual(
      labelledPhoneNumbers(text, labels).map((number) => [number.digits, number.label]),
      [
        ["0312345678", "phone"],
        ["0312345679", "fax"],
      ],
    );
  });

  it("reads nothing from empty text or without labels", () => {
    assert.deepEqual(labelledPhoneNumbers("", labels), []);
    assert.deepEqual(labelledPhoneNumbers("電話：03-1234-5678", []), []);
  });

  it("swapsNeighbours holds only for one swap of neighbours", () => {
    assert.equal(swapsNeighbours("0120123456", "0120123465"), true);
    assert.equal(swapsNeighbours("0120123456", "0120123456"), false);
    assert.equal(swapsNeighbours("0120123456", "0120123654"), false);
    assert.equal(swapsNeighbours("0120123456", "0120123457"), false);
    assert.equal(swapsNeighbours("0120123456", "012012345"), false);
    assert.equal(swapsNeighbours("", ""), false);
  });

  it("phoneVariants compares only numbers of one label", () => {
    const at = (offset: number, digits: string, label: string) => ({ offset, written: digits, digits, label });
    assert.deepEqual(phoneVariants([at(0, "0312345678", "phone"), at(20, "0312345687", "fax")]), []);
    assert.deepEqual(phoneVariants([at(0, "0312345678", "phone"), at(20, "0312345687", "phone")]), [
      { number: at(20, "0312345687", "phone"), other: at(0, "0312345678", "phone") },
    ]);
    assert.deepEqual(phoneVariants([]), []);
  });
});
