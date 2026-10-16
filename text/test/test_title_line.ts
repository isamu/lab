import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isTitleLine, type TitleNotion } from "../packages/chaff/src/title-line.ts";
import { CAPTION_TITLE } from "../packages/chaff/src/figure-references.ts";
import { INSTRUMENT_TITLE } from "../packages/chaff/src/structure/attached-parts.ts";

// A title on a line of its own (Exhibit A to Merger Agreement), read by dangling-figure-reference (a caption) and by
// duplicate-definition (where an attached instrument starts). The two notions differ only where their parameters say.

const titleAt = (source: string, line: string, notion: TitleNotion): boolean => {
  const start = source.indexOf(line);
  const end = source.indexOf("\n", start);
  return isTitleLine(source, start, end, source.slice(start + "Exhibit A".length, end === -1 ? source.length : end), notion);
};

const SEED = Number(process.env["TITLE_LINE_SEED"] ?? Date.now() % 2147483647);
const randomOf = (initial: number): ((n: number) => number) => {
  const state = { seed: initial };
  return (n: number): number => {
    state.seed = (state.seed * 1103515245 + 12345) % 2147483648;
    return state.seed % n;
  };
};

const WORDS = ["to", "Merger", "Agreement", "the", "lists", "prices", "Form", "of", "Note", "And", "Plan"];
const ENDS = ["", ".", ":", ";", ",", "?", "。", " ", "\r"];
const BLANKS = ["", " ", "\t", "\r", "\u3000", "\u00a0", "  \r"];
const OTHER = ["Some text here.", "b", "FIRST: The name is Example Corp."];

type Case = { readonly source: string; readonly start: number; readonly end: number; readonly rest: string };

/** A few lines, one of them a title candidate; the edges and blank lines use the whitespace the two notions disagree on. */
const generated = (random: (n: number) => number): Case => {
  const pick = (items: readonly string[]): string => items[random(items.length)] ?? "";
  const words = Array.from({ length: random(9) }, () => pick(WORDS));
  const rest = [...words.map((word) => " " + word), pick(ENDS)].join("");
  const around = (): string[] => Array.from({ length: random(3) }, () => (random(2) === 0 ? pick(BLANKS) : pick(OTHER)));
  const before = around();
  const after = around();
  const newline = pick(["\n", "\r\n"]);
  const head = before.map((line) => `${line}${newline}`).join("");
  const tail = after.map((line) => `${newline}${line}`).join("");
  const source = `${head}Exhibit A${rest}${tail}`;
  const start = head.length;
  const end = source.indexOf("\n", start);
  return { source, start, end, rest };
};

const titled = (sample: Case, notion: TitleNotion): boolean => isTitleLine(sample.source, sample.start, sample.end, sample.rest, notion);
const PLAIN_WHITESPACE = /^[^\u3000\u00a0\v\f]*$/u;
const RUNS_ON = /[:;,]$/u;
const LOWER_LONG_WORD = /(?:^|\s)\p{Ll}\S{3,}/u;

describe(`title-line (seed ${String(SEED)}; rerun with TITLE_LINE_SEED)`, () => {
  it("the edge: any-whitespace also crosses a line of U+3000 at the document's edge; blank-line does not", () => {
    assert.equal(titleAt("\u3000\nExhibit A", "Exhibit A", CAPTION_TITLE), true);
    assert.equal(titleAt("\u3000\nExhibit A", "Exhibit A", INSTRUMENT_TITLE), false);
    assert.equal(titleAt("Exhibit A\n\u00a0", "Exhibit A", CAPTION_TITLE), true);
    assert.equal(titleAt("Exhibit A\n\u00a0", "Exhibit A", INSTRUMENT_TITLE), false);
    assert.equal(titleAt("x\n \t\nExhibit A\n\ny", "Exhibit A", INSTRUMENT_TITLE), true);
    assert.equal(titleAt("x\nExhibit A\n\ny", "Exhibit A", CAPTION_TITLE), false);
    assert.equal(titleAt("x\n\nExhibit A\ny", "Exhibit A", INSTRUMENT_TITLE), false);
  });

  it("sentenceEnd: an instrument's title may not end in : ; , but a caption's may", () => {
    assert.equal(titleAt("x\n\nExhibit A to Note:\n\ny", "Exhibit A", CAPTION_TITLE), true);
    assert.equal(titleAt("x\n\nExhibit A to Note:\n\ny", "Exhibit A", INSTRUMENT_TITLE), false);
    assert.equal(titleAt("x\n\nExhibit A to Note.\n\ny", "Exhibit A", CAPTION_TITLE), false);
  });

  it("capitalised: a caption's long words start with a capital, an instrument's need not", () => {
    assert.equal(titleAt("x\n\nExhibit A lists prices\n\ny", "Exhibit A", CAPTION_TITLE), false);
    assert.equal(titleAt("x\n\nExhibit A lists prices\n\ny", "Exhibit A", INSTRUMENT_TITLE), true);
    assert.equal(titleAt("x\n\nExhibit A to The Agreement Of Merger And Plan Of It\n\ny", "Exhibit A", INSTRUMENT_TITLE), false);
  });

  it("over generated lines, the notions differ only where a parameter says they do", () => {
    const random = randomOf(SEED);
    Array.from({ length: 5000 }, () => generated(random)).forEach((sample) => {
      const caption = titled(sample, CAPTION_TITLE);
      const instrument = titled(sample, INSTRUMENT_TITLE);
      const context = JSON.stringify(sample);
      // any-whitespace and no extra end marks accept everything blank-line with : ; , accepts, given the same capitals rule.
      if (instrument && !LOWER_LONG_WORD.test(sample.rest)) assert.equal(caption, true, context);
      if (PLAIN_WHITESPACE.test(sample.source) && !RUNS_ON.test(sample.rest.trim()) && !LOWER_LONG_WORD.test(sample.rest)) {
        assert.equal(caption, instrument, context);
      }
      if (caption && PLAIN_WHITESPACE.test(sample.source) && !RUNS_ON.test(sample.rest.trim())) assert.equal(instrument, true, context);
    });
  });
});
