import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 日付の中の月の略記（SEP 01, 2022、12-SEP-2025）は略語ではない。日付と読めるのは年が隣にあるときだけなので、
// 年の無い SEP（Simplified Employee Pension）は略語のまま数える。例文はすべて自作。

const dateOf = (text: string): (string | number | undefined)[] => (en.structure?.dates?.(text) ?? []).map((mention) => mention.attrs["value"]);

describe("lang-en: 月の略記と大文字の月", () => {
  [
    ["SEP 01, 2022", ["2022-09-01"]],
    ["Posted Sep 1, 2022.", ["2022-09-01"]],
    ["Posted Sept. 12, 2025.", ["2025-09-12"]],
    ["Posted Jan. 5, 2024.", ["2024-01-05"]],
    ["Revised: 12-SEP-2025", ["2025-09-12"]],
    ["Revised 3-Jan-2024 by the team.", ["2024-01-03"]],
    ["Revised 12 SEP 2025.", ["2025-09-12"]],
    ["DECEMBER 31, 2024", ["2024-12-31"]],
    ["Filed in DEC 2024.", ["2024-12"]],
  ].forEach(([text, expected]) => {
    it(`${String(text)} → ${String(expected)}`, () => assert.deepEqual(dateOf(String(text)), expected));
  });

  [
    "Open a SEP account.",
    "The SEP 2 form is due.",
    "MAY 2 servers restart?",
    "Mar the surface and sand it.",
    "The JAN-2024 build.",
    "Ref 12-ABC-2025 applies.",
    "Order 112-SEP-2025 shipped.",
  ].forEach((text) => {
    it(`日付ではない: ${text}`, () => assert.deepEqual(dateOf(text), []));
  });
});

describe("undefined-acronym: 日付の中の月", () => {
  const acronymsIn = (body: string): string[] => reportedAcronyms(en, `# Notice\n\n${body}\n`).toSorted((left, right) => left.localeCompare(right, "en"));

  [
    ["SEP 01, 2022\n\nThe SRE joins.", ["SRE"]],
    ["Posted OCT 3, 2024. The SRE joins.", ["SRE"]],
    ["Revised 12 SEP 2025. The SRE joins.", ["SRE"]],
    ["Revised: 12-SEP-2025. The SRE joins.", ["SRE"]],
  ].forEach(([body, expected]) => {
    it(`数えない: ${JSON.stringify(body)}`, () => assert.deepEqual(acronymsIn(String(body)), expected));
  });

  [
    ["SEP 01, 2022\n\nOpen a SEP account.", ["SEP"]],
    ["The SEP 2 form is due.", ["SEP"]],
    ["The DEC team met in 2024.", ["DEC"]],
  ].forEach(([body, expected]) => {
    it(`数える: ${JSON.stringify(body)}`, () => assert.deepEqual(acronymsIn(String(body)), expected));
  });
});
