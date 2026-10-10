import { escapeRegExp } from "../orthography.ts";
import type { StructureIssue } from "./issues.ts";

/**
 * 検針票で、今回の指示数 − 前回の指示数（乗率があれば × 乗率）が、書いた使用量と合わない所。読む側（meter-usage-read.ts）が
 * 一つのまとまり（見出しから見出しまで、または表の一行）ごとに、語彙表 meter-reading-label の名前の付いた値を集めて渡す。
 * 今回・前回・使用量が一つずつそろい、どれも単位が読めて食い違わないときだけ比べる。今回が前回より小さいのは、メーターが
 * 一巡したと書いてあるとき（同じ節で打ち消していないとき）だけ、前回の桁数の上限を足して読む。乗率が書いてあって読めないとき、メーターを取り替えたと書いて
 * あるときは比べない。使用量は書いた桁までの丸め（切り捨て・四捨五入・切り上げ）を認める。Pure.
 */
export type MeterKind = "current" | "previous" | "usage" | "multiplier";

export type MeterEntry = {
  readonly kind: MeterKind;
  /** The value as written after its label, or the cell's text. */
  readonly value: string;
  /** Where the value starts in the document. */
  readonly offset: number;
  /** The unit a table heading gives its column ("kWh"), when it gives one. */
  readonly headerUnit?: string;
};

/** One bill's readings: the named values of a section or a table row, and the section's text (for a stated rollover). */
export type MeterGroup = { readonly entries: readonly MeterEntry[]; readonly text: string };

export type MeterUnitWord = { readonly pattern: string; readonly unit: string };

export type MeterWords = {
  /** Unit words and the unit they name (meter-unit): "m³" and "立方メートル" are both m3. */
  readonly units: readonly MeterUnitWord[];
  /** Words saying the meter went past its last figure (meter-event, group rollover). */
  readonly rollover: readonly string[];
  /** Words after a rollover word, in its clause, that deny it (「一巡していません」): meter-event, group rollover-negation-after. */
  readonly rolloverNegationAfter: readonly string[];
  /** Words before a rollover word, in its clause, that deny it ("has not rolled over"): group rollover-negation-before. */
  readonly rolloverNegationBefore: readonly string[];
  /** Words saying the meter was replaced (meter-event, group replaced): the two readings are of different meters. */
  readonly replaced: readonly string[];
};

/** A number as written: its value in units of its last digit, and how many decimals it has. */
type Reading = {
  readonly scaled: bigint;
  readonly decimals: number;
  readonly digits: number;
  readonly unit: string;
  readonly grouped: boolean;
  readonly written: string;
};

const LEADING_NUMBER = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?![\d,])/u;
const MULTIPLIER = /^[×x*]?\s*(\d+(?:\.\d+)?)\s*(?:倍|times)?$/u;
const TEN = 10n;

const normal = (text: string): string => text.normalize("NFKC").replace(/[*_`]/gu, "").trim();

/** "36m3 (2か月分)" → "36m3": the bracket a value or a name ends with is a note. Brackets are ASCII once NFKC-normalised. */
export const withoutTrailingNote = (text: string): string => {
  const open = text.lastIndexOf("(");
  return text.endsWith(")") && open >= 0 ? text.slice(0, open).trimEnd() : text;
};

const unitOf = (word: string, words: MeterWords): string | undefined => {
  const wanted = word.toLowerCase();
  if (wanted === "") return "";
  return words.units.find((unit) => unit.pattern.normalize("NFKC").toLowerCase() === wanted)?.unit;
};

/** "12,640", "350kWh", "36m³（2か月分）". Undefined when the value is not one number, or its word is not a meter unit. */
export const readingOf = (entry: MeterEntry, words: MeterWords): Reading | undefined => {
  const written = normal(entry.value);
  const number = withoutTrailingNote(written);
  const match = LEADING_NUMBER.exec(number);
  if (match === null) return undefined;
  const [matched, whole = "", fraction = ""] = match;
  const own = unitOf(number.slice(matched.length).trim(), words);
  if (own === undefined) return undefined;
  const digits = whole.replaceAll(",", "");
  return {
    scaled: BigInt(`${digits}${fraction}`),
    decimals: fraction.length,
    digits: digits.length,
    unit: own === "" ? (entry.headerUnit ?? "") : own,
    grouped: whole.includes(","),
    written,
  };
};

/** The multiplier as a scaled number ("×10" → 10, "1.5" → 15 with one decimal); undefined when it cannot be read. */
export const multiplierOf = (value: string): { readonly scaled: bigint; readonly decimals: number } | undefined => {
  const match = MULTIPLIER.exec(normal(value).toLowerCase());
  if (match === null) return undefined;
  const [whole = "", fraction = ""] = (match[1] ?? "").split(".");
  return { scaled: BigInt(`${whole}${fraction}`), decimals: fraction.length };
};

const rescaled = (scaled: bigint, from: number, to: number): bigint => scaled * TEN ** BigInt(to - from);

const ofKind = (entries: readonly MeterEntry[], kind: MeterKind): MeterEntry[] => entries.filter((entry) => entry.kind === kind);

const folded = (text: string): string => text.normalize("NFKC").toLowerCase().replaceAll("\u2019", "'");

const mentions = (text: string, phrases: readonly string[]): boolean => {
  const lowered = folded(text);
  return phrases.some((phrase) => lowered.includes(folded(phrase)));
};

/** A negation across one of these is about something else: 「一巡しましたが、交換はしていません」. */
const CLAUSE_END = /[、。,.;:!?\n]/u;
const LATIN_LETTER = /\p{Script=Latin}/u;

const startsOf = (text: string, phrase: string): number[] =>
  phrase === "" ? [] : [...text.matchAll(new RegExp(escapeRegExp(phrase), "gu"))].map((match) => match.index);

/** A Latin edge of the phrase must not run on into a letter: "not" is not in "notice", "never" not in "whenever". */
const isWordAt = (text: string, phrase: string, start: number): boolean => {
  const joins = (edge: string, neighbour: string): boolean => LATIN_LETTER.test(edge) && LATIN_LETTER.test(neighbour);
  return !joins(phrase.at(0) ?? "", text[start - 1] ?? "") && !joins(phrase.at(-1) ?? "", text[start + phrase.length] ?? "");
};

/** "has not yet rolled over"; in "was not replaced and rolled over" the "not" is about something else. */
const MAX_WORDS_AFTER_NEGATION = 1;

type Reach = (text: string, end: number) => boolean;

const anywhere: Reach = () => true;

const nextToEnd: Reach = (text, end) =>
  text
    .slice(end)
    .split(/\s+/u)
    .filter((word) => word !== "").length <= MAX_WORDS_AFTER_NEGATION;

const hasWord = (text: string, phrases: readonly string[], reaches: Reach): boolean =>
  phrases.some((phrase) => {
    const wanted = folded(phrase);
    return startsOf(text, wanted).some((start) => isWordAt(text, wanted, start) && reaches(text, start + wanted.length));
  });

/** The rollover word at start is denied by a negation in its own clause: after it, or (in English) just before it. */
const isDenied = (text: string, start: number, length: number, words: MeterWords): boolean => {
  const before = text.slice(0, start).split(CLAUSE_END).at(-1) ?? "";
  const after = text.slice(start + length).split(CLAUSE_END)[0] ?? "";
  return hasWord(after, words.rolloverNegationAfter, anywhere) || hasWord(before, words.rolloverNegationBefore, nextToEnd);
};

/** Some rollover word is written and not denied in its clause. */
export const statesRollover = (text: string, words: MeterWords): boolean => {
  const lowered = folded(text);
  return words.rollover.some((phrase) => {
    const wanted = folded(phrase);
    return startsOf(lowered, wanted).some((start) => !isDenied(lowered, start, wanted.length, words));
  });
};

/** The units of the three agree: each is unstated or the same one. */
const unitsAgree = (readings: readonly Reading[]): boolean => new Set(readings.map((reading) => reading.unit).filter((unit) => unit !== "")).size <= 1;

/** current − previous at the readings' common scale; a stated rollover adds the previous reading's next power of ten. */
const difference = (current: Reading, previous: Reading, scale: number, group: MeterGroup, words: MeterWords): bigint | undefined => {
  const plain = rescaled(current.scaled, current.decimals, scale) - rescaled(previous.scaled, previous.decimals, scale);
  if (plain >= 0n) return plain;
  if (!statesRollover(group.text, words)) return undefined;
  return plain + rescaled(TEN ** BigInt(previous.digits), 0, scale);
};

/** Usage is written to its last digit, so any value within one step of it, either side, is a rounding of it. */
const withinRounding = (expected: bigint, usage: Reading, scale: number): boolean => {
  const gap = expected - rescaled(usage.scaled, usage.decimals, scale);
  const step = TEN ** BigInt(scale - usage.decimals);
  return gap < step && gap > -step;
};

const shown = (scaled: bigint, decimals: number, grouped: boolean): string => {
  const text = scaled.toString().padStart(decimals + 1, "0");
  const whole = text.slice(0, text.length - decimals);
  const groupedWhole = grouped ? BigInt(whole).toLocaleString("en-US") : whole;
  return decimals === 0 ? groupedWhole : `${groupedWhole}.${text.slice(text.length - decimals)}`;
};

type Parts = { readonly current: MeterEntry; readonly previous: MeterEntry; readonly usage: MeterEntry; readonly multiplier: MeterEntry | undefined };

/** One of each of the three, and at most one multiplier; two meters in one place are not told apart. */
const partsOf = (group: MeterGroup): Parts | undefined => {
  const [current, ...moreCurrent] = ofKind(group.entries, "current");
  const [previous, ...morePrevious] = ofKind(group.entries, "previous");
  const [usage, ...moreUsage] = ofKind(group.entries, "usage");
  const [multiplier, ...moreMultiplier] = ofKind(group.entries, "multiplier");
  if (current === undefined || previous === undefined || usage === undefined) return undefined;
  if (moreCurrent.length + morePrevious.length + moreUsage.length + moreMultiplier.length > 0) return undefined;
  return { current, previous, usage, multiplier };
};

const groupIssue = (group: MeterGroup, words: MeterWords): StructureIssue[] => {
  const parts = partsOf(group);
  if (parts === undefined || mentions(group.text, words.replaced)) return [];
  const current = readingOf(parts.current, words);
  const previous = readingOf(parts.previous, words);
  const usage = readingOf(parts.usage, words);
  const factor = parts.multiplier === undefined ? { scaled: 1n, decimals: 0 } : multiplierOf(parts.multiplier.value);
  if (current === undefined || previous === undefined || usage === undefined || factor === undefined) return [];
  if (!unitsAgree([current, previous, usage])) return [];
  const readScale = Math.max(current.decimals, previous.decimals);
  const diff = difference(current, previous, readScale, group, words);
  if (diff === undefined) return [];
  const scale = Math.max(readScale + factor.decimals, usage.decimals);
  const expected = rescaled(diff * factor.scaled, readScale + factor.decimals, scale);
  if (withinRounding(expected, usage, scale)) return [];
  const times = parts.multiplier === undefined ? "" : ` × ${shown(factor.scaled, factor.decimals, false)}`;
  return [
    {
      offset: parts.current.offset,
      values: {
        current: current.written,
        previous: previous.written,
        times,
        expected: shown(expected, scale, current.grouped || usage.grouped),
        usage: usage.written,
      },
    },
  ];
};

export const meterUsageMismatches = (groups: readonly MeterGroup[], words: MeterWords): StructureIssue[] => groups.flatMap((group) => groupIssue(group, words));
