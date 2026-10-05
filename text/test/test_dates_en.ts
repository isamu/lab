import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { StructurePatterns } from "../packages/chaff/src/plugin.ts";

type Attr = number | string | undefined;

const patterns = (): StructurePatterns => {
  if (en.structure === undefined) throw new Error("lang-en has no structure");
  return en.structure;
};

const dateOf = (text: string): Attr[] => (patterns().dates?.(text) ?? []).map((mention) => mention.attrs["value"]);

const markers = (text: string): Attr[] =>
  patterns()
    .obligations(text)
    .map((mention) => mention.attrs["marker"]);

describe("English dates", () => {
  const cases: readonly (readonly [string, readonly string[]])[] = [
    ["This Agreement is made on April 1, 2024.", ["2024-04-01"]],
    ["It ends on 31 March 2025.", ["2025-03-31"]],
    ["It ends on March 31st, 2025.", ["2025-03-31"]],
    ["Released on 2024-04-01 and patched on 2024-05-10.", ["2024-04-01", "2024-05-10"]],
    ["Published in May 2023.", ["2023-05"]],
    ["From January 2024 to December 2024.", ["2024-01", "2024-12"]],
    ["The results are sent on October 28.", ["10-28"]],
    ["Pay by June 30th.", ["06-30"]],
    ["We met on 5 March and again on Sept. 12.", ["03-05", "09-12"]],
    ["The board met on 3 May to vote.", ["05-03"]],
    ["From December 28 to January 3.", ["12-28", "01-03"]],
    ["Monday, July 20 (Monday)", ["07-20"]],
    ["Held 5 March to 7 April 2026, the year written once.", ["2026-04-07"]],
  ];
  cases.forEach(([text, expected]) => {
    it(text, () => assert.deepEqual(dateOf(text), expected));
  });

  const negatives: readonly string[] = [
    "We may meet in May.",
    "Mark the Monday on the calendar.",
    "In 2024 we moved.",
    "Section 2024-1 applies.",
    "April is a name here.",
    "The window runs March 5 – 7, 2026.",
    "The conference is March 5, 6, and 7, 2026.",
    "N Engl J Med. 2025 Dec 18;393(24).",
    "The storm on 1872 February 4.",
    "Rule 3 May Apply",
    "At March 5:30 the line opens.",
    "Ship March 50 units.",
  ];
  negatives.forEach((text) => {
    it(`no date: ${text}`, () => assert.deepEqual(dateOf(text), []));
  });
});

describe("“May” the month is not “may” the permission", () => {
  const cases: readonly (readonly [string, readonly string[]])[] = [
    ["We may meet in May.", ["may"]],
    ["Published in May 2023, the method may be reused.", ["may"]],
    ["May the Buyer assign this Agreement?", ["may"]],
    ["It is agreed. May the Buyer assign it?", ["may"]],
    ["The Seller shall deliver by May 1, 2024.", ["shall"]],
  ];
  cases.forEach(([text, expected]) => {
    it(text, () => assert.deepEqual(markers(text), expected));
  });
});

describe("countedAfter (a dotted number or an amount)", () => {
  const cases: readonly (readonly [string, string, boolean])[] = [
    ["2.5", "days is the longest", true],
    ["1.5", "times more", true],
    ["3.5", "percent of revenue", true],
    ["4.2", "Payment Terms", false],
    ["1.1", "Scope", false],
    ["2.1", "daylight saving", false],
  ];
  cases.forEach(([number, rest, expected]) => {
    it(`${number} ${rest} → ${String(expected)}`, () => assert.equal(patterns().countedAfter?.(number, rest), expected));
  });
});

describe("a tab between a number and its unit or currency", () => {
  const amounts = (text: string): [Attr, Attr][] =>
    patterns()
      .quantities(text)
      .map((mention) => [mention.attrs["value"], mention.attrs["unit"]]);
  it("reads 30<tab>days and USD<tab>500", () => {
    assert.deepEqual(amounts("Within 30\tdays, pay USD\t500."), [
      [30, "days"],
      [500, "USD"],
    ]);
  });
});
