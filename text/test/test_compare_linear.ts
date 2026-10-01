import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { maskSpans } from "../packages/chaff/src/mask.ts";
import { QUOTATION_MARKS, quotedSpans } from "../packages/chaff/src/quoted-span.ts";
import { bareUrls } from "../packages/chaff/src/bare-url.ts";
import { readMarkdown } from "../packages/chaff/src/markdown-read.ts";
import { compareAtoms } from "../packages/chaff/src/compare/match.ts";
import { clockTimes } from "../packages/chaff/src/compare/clock-time.ts";
import { seenTextOf } from "../packages/chaff/src/compare/fact-key.ts";
import { factTextOf } from "../packages/chaff/src/compare/fact-text.ts";
import { bareNumbers, quotations, teamNames } from "../packages/chaff/src/compare/text-atoms.ts";
import { unwrittenNames } from "../packages/chaff/src/compare/written-names.ts";
import type { Atom } from "../packages/chaff/src/compare/atom.ts";
import type { Span } from "../packages/chaff/src/plugin.ts";

// A long document is read in time proportional to its length: each of these took minutes, or would, when read
// once per span, quotation or atom. The properties keep what the faster code must still do.

const LONG = 100_000;
const LONG_TIMEOUT_MS = 30_000;

const generator = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
};

const SEED = Number(process.env["CHAFF_SEED"] ?? 20_261_001);
const ALPHABET = ["a", " ", "\n", "「", "」", "『", "』", "“", "”", '"', "字"];

const randomText = (random: () => number, length: number): string =>
  Array.from({ length }, () => ALPHABET[Math.floor(random() * ALPHABET.length)] ?? "").join("");

const randomSpan = (random: () => number, length: number): Span => {
  const [a, b] = [Math.floor(random() * (length + 1)), Math.floor(random() * (length + 1))];
  return { start: Math.min(a, b), end: Math.max(a, b) };
};

/** Character by character: a space for each character inside a span, except a line break, which stays. */
const expectedMask = (text: string, spans: readonly Span[]): string =>
  text
    .split("")
    .map((char, at) => (char !== "\n" && spans.some((span) => at >= span.start && at < span.end) ? " " : char))
    .join("");

const crossing = (spans: readonly Span[]): Span[] =>
  spans.filter((one) => spans.some((other) => one.start < other.start && other.start < one.end && one.end < other.end));

describe(`maskSpans (seed ${String(SEED)})`, () => {
  it("keeps the length and the line breaks, blanks every character inside a span and nothing outside", () => {
    const random = generator(SEED);
    Array.from({ length: 2_000 }).forEach(() => {
      const text = randomText(random, Math.floor(random() * 50));
      const spans = Array.from({ length: Math.floor(random() * 6) }, () => randomSpan(random, text.length));
      const masked = maskSpans(text, spans);
      assert.equal(masked.length, text.length);
      assert.equal(masked, expectedMask(text, spans), JSON.stringify({ text, spans }));
    });
  });

  it(`masks ${String(LONG)} spans`, { timeout: LONG_TIMEOUT_MS }, () => {
    const text = "ab".repeat(LONG);
    const spans = Array.from({ length: LONG }, (_, index) => ({ start: index * 2, end: index * 2 + 1 }));
    assert.equal(maskSpans(text, spans), " b".repeat(LONG));
  });
});

describe(`quotedSpans (seed ${String(SEED)})`, () => {
  it("returns spans that an opening mark starts and its own closing mark ends, nested or apart, never crossing", () => {
    const random = generator(SEED + 1);
    Array.from({ length: 2_000 }).forEach(() => {
      const text = randomText(random, Math.floor(random() * 40));
      const spans = quotedSpans(text, QUOTATION_MARKS);
      spans.forEach((span) => assert.equal(QUOTATION_MARKS[text[span.start - 1] ?? ""], text[span.end], JSON.stringify({ text, span })));
      assert.deepEqual(crossing(spans), [], text);
    });
  });

  it("closes the innermost quotation first, and ignores a closing mark left over", () => {
    assert.deepEqual(quotedSpans("「『a』b」」"), [
      { start: 2, end: 3 },
      { start: 1, end: 5 },
    ]);
  });

  it(`reads ${String(LONG)} quotations and ${String(LONG)} unclosed openings`, { timeout: LONG_TIMEOUT_MS }, () => {
    assert.equal(quotedSpans("「あ」".repeat(LONG)).length, LONG);
    assert.equal(quotedSpans("「".repeat(LONG)).length, 0);
  });
});

describe("bareUrls", () => {
  it("leaves the sentence's punctuation out of the URL", () => {
    assert.deepEqual(
      bareUrls("See https://example.com/a. Or https://example.com/b, then https://example.com/c?q=1。 詳しくは https://example.jp/をご覧ください").map(
        (url) => url.url,
      ),
      ["https://example.com/a", "https://example.com/b", "https://example.com/c?q=1", "https://example.jp/"],
    );
  });

  it(`reads a URL ending in ${String(LONG)} punctuation marks`, { timeout: LONG_TIMEOUT_MS }, () => {
    assert.deepEqual(
      bareUrls(`https://example.com${".".repeat(LONG)}x`).map((url) => url.url),
      [`https://example.com${".".repeat(LONG)}x`],
    );
    assert.deepEqual(
      bareUrls(`https://example.com${".".repeat(LONG)}`).map((url) => url.url),
      ["https://example.com"],
    );
  });
});

const atom = (kind: Atom["kind"], key: string, text: string, line: number): Atom => ({ kind, key, text, line });

describe("compare on long documents", () => {
  it(`compares ${String(LONG)} headings of one level, written differently`, { timeout: LONG_TIMEOUT_MS }, () => {
    const before = Array.from({ length: LONG }, (_, index) => atom("heading", "##", `h${String(index)}`, index));
    const after = before.map((heading) => ({ ...heading, text: `${heading.text}!` }));
    const result = compareAtoms(before, after);
    assert.equal(result.reformed.length, LONG);
    assert.equal(result.dropped.length, 0);
  });

  it(`compares ${String(LONG)} copies of one number`, { timeout: LONG_TIMEOUT_MS }, () => {
    const before = Array.from({ length: LONG }, (_, index) => atom("number", "1 ", "1", index));
    assert.equal(compareAtoms(before, before.slice(1)).dropped.length, 1);
  });

  it(`reads ${String(LONG)} times, numbers, quotations and names`, { timeout: LONG_TIMEOUT_MS }, () => {
    const text = "10:30 「あ」 Acme 7 ".repeat(LONG);
    const input = { text, source: text, lineOf: () => 1 };
    assert.equal(clockTimes(text).length, LONG);
    assert.equal(quotations(input, []).length, LONG);
    assert.equal(teamNames(text, ["Acme", "Acme Cloud"]).length, LONG);
    assert.equal(bareNumbers(input, []).length, LONG * 3);
  });

  it(`keys ${String(LONG)} quotations among as many vanishing line breaks`, { timeout: LONG_TIMEOUT_MS }, () => {
    const text = "「系の\nシ」".repeat(LONG);
    const unseen = Array.from({ length: LONG }, (_, index) => ({ start: index * 6 + 3, end: index * 6 + 4 }));
    const keys = quotations({ text, source: text, lineOf: () => 1 }, unseen).map((quote) => quote.key);
    assert.deepEqual([keys.length, keys[0], keys.at(-1)], [LONG, "系のシ", "系のシ"]);
  });

  it(`reads a text with ${String(LONG)} unseen parts as a reader sees it`, { timeout: LONG_TIMEOUT_MS }, () => {
    const text = "日本\n銀行".repeat(LONG);
    const unseen = Array.from({ length: LONG }, (_, index) => ({ start: index * 5 + 2, end: index * 5 + 3 }));
    const seen = seenTextOf(text, unseen);
    assert.deepEqual([seen.text.length, seen.offsets.at(-1)], [LONG * 4, LONG * 5 - 1]);
  });

  it(`blanks ${String(LONG)} pieces of code and links`, { timeout: LONG_TIMEOUT_MS }, () => {
    const source = "`a` https://x.com/1 [b](https://y.com) ".repeat(LONG / 4);
    const facts = factTextOf(source, readMarkdown(source).root);
    assert.equal(facts.bareUrls.length, LONG / 4);
    assert.equal(facts.text.length, source.length);
  });

  it(`checks ${String(LONG)} names against the other document once per name`, { timeout: LONG_TIMEOUT_MS }, () => {
    const names = Array.from({ length: LONG }, (_, index) => atom("name", "Acme", "Acme", index));
    assert.equal(unwrittenNames(names, names, "Acme ".repeat(LONG)).length, 0);
  });
});
