import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addressSpans, clockTimeSpans, identifierSpans, isInsideSpan } from "../packages/chaff/src/spacing-code.ts";

// Where a clock time and an address sit in a sentence. Every example is self-written.

const texts = (text: string, spans: readonly { start: number; end: number }[]): string[] => spans.map((span) => text.slice(span.start, span.end));

describe("clockTimeSpans", () => {
  it("finds hours and minutes, with seconds or a full-width colon", () => {
    const text = "受付 9:05、開始 13:30、終了 17：15、記録 08:00:15";
    assert.deepEqual(texts(text, clockTimeSpans(text)), ["9:05", "13:30", "17：15", "08:00:15"]);
  });

  it("does not read a ratio past 59, a version, a verse or a longer number as a time", () => {
    for (const text of ["比は 3:75", "版 1.2:30", "第123:45条", "1:2:3:4", "ID 12:345"]) assert.deepEqual(clockTimeSpans(text), [], text);
  });

  it("finds nothing in an empty text", () => assert.deepEqual(clockTimeSpans(""), []));
});

describe("addressSpans", () => {
  it("finds an e-mail address and a URL, ending where Japanese text starts", () => {
    const text = "質問は privacy@hibari-lab.example へ。手順は https://example.com/faq?q=1にあり、www.example.jp も見てください。";
    assert.deepEqual(texts(text, addressSpans(text)), ["privacy@hibari-lab.example", "https://example.com/faq?q=1", "www.example.jp"]);
  });

  it("does not read a bare @ or a word with a dot as an address", () => {
    for (const text of ["@ の印", "user@", "例 e.g. です", "名前@ドメイン"]) assert.deepEqual(addressSpans(text), [], text);
  });
});

describe("identifierSpans", () => {
  it("finds a booking or model number: letters and a serial joined by hyphens, or capitals and four digits or more", () => {
    const text = "予約番号 MN-48215 を伝え、型番 SB-210 と KM-SP300、注文 A1234567 で届く。";
    assert.deepEqual(texts(text, identifierSpans(text)), ["MN-48215", "SB-210", "KM-SP300", "A1234567"]);
  });

  it("reads a full-width or Japanese hyphen as a hyphen", () => {
    const text = "型番 KM－SP300 と、予約番号 MN‐48215 を伝える。";
    assert.deepEqual(texts(text, identifierSpans(text)), ["KM－SP300", "MN‐48215"]);
  });

  it("does not read a short name, a digit-only code, a word without a digit or part of a longer run as an identifier", () => {
    for (const text of [
      "UTF-8 で",
      "COVID-19 の",
      "EC2 で",
      "H30 等",
      "Office365 を",
      "ISO 9001 に",
      "073-489-5909 へ",
      "Wi-Fi で",
      "v1.2-345 の",
      "AB-123.4 の",
      "",
    ])
      assert.deepEqual(identifierSpans(text), [], text);
  });
});

describe("isInsideSpan", () => {
  it("counts the start and not the end", () => {
    assert.ok(isInsideSpan([{ start: 2, end: 4 }], 2));
    assert.ok(!isInsideSpan([{ start: 2, end: 4 }], 4));
    assert.ok(!isInsideSpan([], 0));
  });
});
