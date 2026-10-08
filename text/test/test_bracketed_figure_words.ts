import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { StructurePatterns } from "../packages/chaff/src/plugin.ts";

const patterns = (): StructurePatterns => {
  if (en.structure === undefined) throw new Error("lang-en has no structure");
  return en.structure;
};

/** The words that may stand before "(6) days". zero and the scales above a thousand are number words but never count a period. */
const COUNTING_WORDS = new Set([
  ...["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen"],
  ...["fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty"],
  ...["ninety", "hundred", "thousand"],
]);
const OTHER_WORDS = ["zero", "million", "billion", "trillion", "and", "percent", "cent", "Section", "paragraph", "Clause", "notice", "sixth", "fortyfive"];

const casings = (word: string): string[] => [word, word.charAt(0).toUpperCase() + word.slice(1), word.toUpperCase()];
const words = [...COUNTING_WORDS, ...OTHER_WORDS].flatMap(casings);
const hyphenated = ["forty-five", "Forty-Five", "twenty-zero", "one-million", "section-six", "six-section", "two-hundred", "-six", "six-"];
const lead = ["", "within ", "Section 3 ", "(a) ", "paragraph (5) percent and "];
const FIGURE = "6";

const lastPart = (word: string): string => word.toLowerCase().split("-").at(-1) ?? "";

/** The figure inside the bracket is read as a quantity: its start offset is among the mentions. */
const readsFigure = (text: string, figureAt: number): boolean =>
  patterns()
    .quantities(text)
    .some((mention) => mention.start === figureAt);

describe("a figure in brackets after a number word", () => {
  it("is a quantity exactly when the word (or its last hyphenated part) counts one to a thousand", () => {
    const cases = lead.flatMap((before) => [...words, ...hyphenated].map((word) => ({ text: `${before}${word} (${FIGURE}) days`, before, word })));
    assert.equal(cases.length, lead.length * (words.length + hyphenated.length));
    const wrong = cases.filter(({ text, before, word }) => {
      const figureAt = before.length + word.length + " (".length;
      assert.equal(text.slice(figureAt, figureAt + FIGURE.length), FIGURE);
      return readsFigure(text, figureAt) !== COUNTING_WORDS.has(lastPart(word));
    });
    assert.deepEqual(
      wrong.map(({ text }) => text),
      [],
    );
  });

  it("reads none of them when the unit after the bracket is missing", () => {
    const misses = [...COUNTING_WORDS].filter((word) => readsFigure(`${word} (${FIGURE}) apples`, word.length + " (".length));
    assert.deepEqual(misses, []);
  });
});
