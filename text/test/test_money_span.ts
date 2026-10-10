import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isMoneySpan, type CurrencyMark } from "../packages/chaff/src/derived/money-span.ts";

const marks: CurrencyMark[] = [
  { pattern: "円", before: false },
  { pattern: "¥", before: true },
  { pattern: "$", before: true },
  { pattern: "USD", before: false },
];

const spanOf = (text: string, part: string): { start: number; end: number } => {
  const start = text.indexOf(part);
  return { start, end: start + part.length };
};

describe("isMoneySpan", () => {
  it("reads a currency unit after the number and a mark right before it as money", () => {
    assert.equal(isMoneySpan("上限は3,000円です", spanOf("上限は3,000円です", "3,000円"), "円", marks), true);
    assert.equal(isMoneySpan("cap of $ 30 a day", spanOf("cap of $ 30 a day", "30 a"), "a", marks), true);
    assert.equal(isMoneySpan("cap ¥3000 total", spanOf("cap ¥3000 total", "3000 total"), "total", marks), true);
    assert.equal(isMoneySpan("10 USD", spanOf("10 USD", "10 USD"), "USD", marks), true);
  });

  it("leaves other amounts alone, and reads nothing as money with no marks", () => {
    assert.equal(isMoneySpan("1日の最大量は4錠です", spanOf("1日の最大量は4錠です", "4錠"), "錠", marks), false);
    assert.equal(isMoneySpan("no more than 4 tablets", spanOf("no more than 4 tablets", "4 tablets"), "tablets", marks), false);
    assert.equal(isMoneySpan("上限は3,000円です", spanOf("上限は3,000円です", "3,000円"), "円", []), false);
    assert.equal(isMoneySpan("", { start: 0, end: 0 }, "", marks), false);
  });
});
