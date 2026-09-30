import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { depthsOf } from "../packages/chaff/src/detectors/oxford-comma.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { wikitextToMarkdown } from "../scripts/wikitext-markdown.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// A word of the document is data, never a property name. Words that name a member every object inherits
// (constructor, toString, __proto__) must read like any other word.

const RULE = "oxford-comma-consistency";
const INHERITED = ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__", "isPrototypeOf"];
const WITHOUT_COMMA = "We shipped the parser, the renderer and the exporter.\nThe team reviewed the plan, the budget and the schedule.";

const tokensOf = (surfaces: readonly string[]): Token[] =>
  surfaces.map((surface, index) => ({ span: { start: index, end: index + 1 }, surface, pos: surface === "(" || surface === ")" ? "PUNCT" : "NOUN" }));

describe("depthsOf: an inherited member's name is a word", () => {
  INHERITED.forEach((word) => {
    it(`keeps counting parentheses after "${word}"`, () => {
      assert.deepEqual(depthsOf(tokensOf(["The", word, "(", "a", ")", "b", ")", "c"])), [0, 0, 0, 1, 1, 0, 0, 0]);
    });
  });
});

describe("oxford-comma-consistency: a sentence with an inherited member's name is judged", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  INHERITED.forEach((word) => {
    it(`judges a list after "${word}"`, () => {
      const candidate = `The ${word} method calls the parser, the renderer, and the exporter.`;
      assert.deepEqual(firedRules(en, `${WITHOUT_COMMA}\n\n${candidate}\n`).includes(RULE), true);
    });
  });
});

describe("wikitextToMarkdown: a template named like an inherited member is an unknown template", () => {
  ["constructor", "Constructor", "CONSTRUCTOR"].forEach((name) => {
    it(`drops {{${name}}} like any template it does not know`, () => {
      assert.equal(wikitextToMarkdown(`Before {{${name}|x}} after.`), wikitextToMarkdown("Before {{unknown|x}} after."));
      assert.equal(wikitextToMarkdown(`* {{${name}}}\nEnd.`), wikitextToMarkdown("* {{unknown}}\nEnd."));
    });
  });
});
