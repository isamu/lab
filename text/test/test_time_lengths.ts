import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { timeLengths, type LengthWords } from "../packages/chaff/src/derived/time-lengths.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HALF_HOUR = 30;

const patterns = (adapter: LanguageAdapter, id: string, weight?: number): string[] =>
  (adapter.lexicons[id] ?? []).filter((entry) => weight === undefined || entry.weight === weight).map((entry) => entry.pattern);

const wordsOf = (adapter: LanguageAdapter): LengthWords => ({
  hourUnits: patterns(adapter, "unit-time", SECONDS_PER_HOUR),
  minuteUnits: patterns(adapter, "unit-time", SECONDS_PER_MINUTE),
  halves: patterns(adapter, "length-half"),
  numberWords: patterns(adapter, "count-number"),
});

const lexicons = { ja: wordsOf(ja), en: wordsOf(en) };

const read = (text: string, words: LengthWords): string[] =>
  timeLengths(text, words).map((length) => `${text.slice(length.start, length.end)}=${String(length.minutes)}/${String(length.unit)}`);

describe("timeLengths with a lexicon left empty", () => {
  it("an empty count-number reads digits, minutes and a half the same", () => {
    const words = { ...lexicons.ja, numberWords: [] };
    assert.deepEqual(read("1時間半", words), ["1時間半=90/30"]);
    assert.deepEqual(read("1時間30分", words), ["1時間30分=90/1"]);
    assert.deepEqual(read("一時間半", words), []);
  });

  it("empty minute units still read a half", () => {
    assert.deepEqual(read("1時間半", { ...lexicons.ja, minuteUnits: [] }), ["1時間半=90/30"]);
  });
});

type Tail = { readonly written: string; readonly minutes: number; readonly unit?: number };

const DIGITS: readonly [string, number][] = [
  ["1", 1],
  ["7", 7],
  ["12", 12],
  ["１", 1],
  ["08", 8],
];
const SEPARATORS = ["", " ", "-"];
const TAILS: readonly Tail[] = [
  { written: "", minutes: 0 },
  { written: "30分", minutes: 30, unit: 1 },
  { written: " 15min", minutes: 15, unit: 1 },
  { written: "１５分", minutes: 15, unit: 1 },
  { written: "半", minutes: HALF_HOUR, unit: HALF_HOUR },
];
/** Text around a length that holds no length of its own. */
const QUIET_CONTEXTS: readonly [string, string][] = [
  ["", ""],
  ["実働", "。"],
  ["work ", " a day"],
];
const CONTEXTS: readonly [string, string][] = [...QUIET_CONTEXTS, ["休憩1時間、実働", "（休憩45分）"]];

type Generated = { readonly text: string; readonly minutes: number; readonly unit: number };

/** Whether the lexicon can read a tail: none at all, a half word, or a minute count ending in one of its units. */
const readableTail = (tail: Tail, words: LengthWords): boolean =>
  tail.written === "" || words.halves.includes(tail.written) || words.minuteUnits.some((unit) => tail.written.endsWith(unit));

/** Every digit-led length the generator writes, with the minutes it says. */
const generated = (words: LengthWords): Generated[] => {
  const tails = TAILS.filter((tail) => readableTail(tail, words));
  const heads = DIGITS.flatMap(([digits, hours]) => SEPARATORS.map((separator) => ({ written: `${digits}${separator}`, hours })));
  const withUnits = heads.flatMap((head) => words.hourUnits.map((hourUnit) => ({ written: `${head.written}${hourUnit}`, hours: head.hours })));
  return withUnits.flatMap((head) =>
    tails.map((tail) => ({
      text: `${head.written}${tail.written}`,
      minutes: head.hours * MINUTES_PER_HOUR + tail.minutes,
      unit: tail.unit ?? MINUTES_PER_HOUR,
    })),
  );
};

type Placed = { readonly written: string; readonly length: Generated };

const inContexts = (cases: readonly Generated[], contexts: readonly (readonly [string, string])[]): Placed[] =>
  cases.flatMap((length) => contexts.map(([before, after]) => ({ written: `${before}${length.text}${after}`, length })));

const describeLanguage = (language: string, words: LengthWords): void => {
  const cases = generated(words);

  it(`${language}: reads the minutes each generated length says`, () => {
    assert.ok(cases.length > DIGITS.length * words.hourUnits.length);
    inContexts(cases, QUIET_CONTEXTS).forEach(({ written, length }) =>
      assert.deepEqual(read(written, words), [`${length.text}=${String(length.minutes)}/${String(length.unit)}`], written),
    );
  });

  it(`${language}: a number word is read as its place in the lexicon, in hours and in minutes`, () => {
    const [hourUnit, minuteUnit] = [words.hourUnits[0] ?? "", words.minuteUnits[0] ?? ""];
    words.numberWords.forEach((word, index) => {
      const place = index + 1;
      assert.deepEqual(read(`a ${word}-${hourUnit} break`, words), [`${word}-${hourUnit}=${String(place * MINUTES_PER_HOUR)}/${String(MINUTES_PER_HOUR)}`]);
      assert.deepEqual(read(`a ${word}-${minuteUnit} break`, words), [`${word}-${minuteUnit}=${String(place)}/1`]);
    });
  });

  it(`${language}: a digit-led length reads the same whichever number words the lexicon holds`, () => {
    const others: LengthWords[] = [
      { ...words, numberWords: [] },
      { ...words, numberWords: ["one"] },
      { ...words, numberWords: ["一", "one", "twelve"] },
    ];
    const pairs = inContexts(cases, CONTEXTS).flatMap(({ written }) => others.map((other) => ({ written, other })));
    pairs.forEach(({ written, other }) => assert.deepEqual(read(written, other), read(written, words), written));
  });
};

describe("timeLengths over generated lengths", () => {
  Object.entries(lexicons).forEach(([language, words]) => describeLanguage(language, words));
});
