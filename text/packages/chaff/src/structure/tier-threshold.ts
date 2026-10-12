// tier-threshold-mismatch: a tier stated for a member ("Tier: Gold") whose own stated value of the tier's unit ("Points earned
// last year: 42,400 points") falls outside that tier's band in the document's tier table or list. A band is read with
// range-band-mismatch's reading (structure/range-bands.ts). Pure.
import { normalizeBandText, parseBand, unitKey, type Band, type BandWords, type Bound } from "./range-bands.ts";

/** One tier as the document defines it: its name and the text that states its band (a cell, or a list item after the colon). */
export type TierEntry = { readonly name: string; readonly text: string };

/** A line "key: value" outside a table, with where the value starts and the section (counted by headings) it is in. */
export type KeyValueLine = { readonly key: string; readonly value: string; readonly valueStart: number; readonly section: number };

export type TierText = { readonly tierRuns: readonly (readonly TierEntry[])[]; readonly lines: readonly KeyValueLine[] };

export type TierWords = {
  readonly band: BandWords;
  /** The keys of a line that states the member's tier (会員ランク, Tier). */
  readonly labels: readonly string[];
  /** Words in a key that make its value some other figure than the one the tier is earned by (残高, needed for next). */
  readonly others: readonly string[];
};

export type TierSlip = {
  readonly offset: number;
  readonly values: { readonly tier: string; readonly band: string; readonly value: string; readonly actual: string };
};

type Edge = { readonly value: number; readonly closed: boolean };

type Tier = { readonly entry: TierEntry; readonly band: Band; readonly low: Edge; readonly high: Edge };

type TierSet = { readonly unit: string; readonly tiers: readonly Tier[] };

const EMPHASIS = /[*_`]/gu;
const NUMBER_RUN = /\d[\d,.]*/gu;
const FIGURE = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/u;
const DIGIT = /\d/u;
const DIGITISH = /[\d,.]/u;
const LATIN = /[a-z]/u;
/** How far before a number a band's word may start (at least, under) and how far after it its unit and word may end. */
const WINDOW_BEFORE = 16;
const WINDOW_AFTER = 24;
/** A text with more numbers than this is a sentence, not a threshold. */
const MAX_NUMBERS = 4;
const MIN_TIERS = 2;

export const plainKey = (text: string): string => text.normalize("NFKC").toLowerCase().replace(EMPHASIS, "").trim();

/** A tier's name as compared: letter case is kept, so "gold" is not the tier "Gold". */
const nameKey = (text: string): string => text.normalize("NFKC").replace(EMPHASIS, "").trim();

const NOT_WORD = /[^\p{L}\p{N}]+/u;

/** A Latin word of the lexicon is a whole word of the key; any other is a part of it (残高 in ポイント残高). */
const hasWord = (key: string, word: string): boolean => {
  const plain = plainKey(word);
  return LATIN.test(plain) ? ` ${key.split(NOT_WORD).join(" ")} `.includes(` ${plain} `) : key.includes(plain);
};

const isStart = (text: string, at: number): boolean => {
  const here = text[at] ?? "";
  const before = text[at - 1] ?? "";
  if (here === " " || here === "") return false;
  if (DIGIT.test(here) && DIGITISH.test(before)) return false;
  return !(LATIN.test(here) && LATIN.test(before));
};

const isEnd = (text: string, at: number): boolean => {
  const last = text[at - 1] ?? "";
  const next = text[at] ?? "";
  if (last === " " || last === "" || DIGIT.test(next)) return false;
  return !(LATIN.test(last) && LATIN.test(next));
};

const range = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);

type Reading = { readonly from: number; readonly to: number; readonly band: Band };

/** Every stretch of the text around its numbers that reads as one band with a unit. */
const readingsOf = (text: string, words: BandWords): Reading[] => {
  const numbers = [...text.matchAll(NUMBER_RUN)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
  if (numbers.length === 0 || numbers.length > MAX_NUMBERS) return [];
  const starts = [...new Set(numbers.flatMap(({ start }) => range(Math.max(0, start - WINDOW_BEFORE), start)))].filter((at) => isStart(text, at));
  const ends = [...new Set(numbers.flatMap(({ end }) => range(end, Math.min(text.length, end + WINDOW_AFTER))))].filter((at) => isEnd(text, at));
  return starts.flatMap((from) =>
    ends.flatMap((to) => {
      const band = to > from ? parseBand(text.slice(from, to), words) : undefined;
      return band === undefined || band.unit === "" ? [] : [{ from, to, band }];
    }),
  );
};

const contains = (outer: Reading, inner: Reading): boolean => outer !== inner && outer.from <= inner.from && inner.to <= outer.to;

/** "10,000 points to" and "under 50,000 points" written one after the other are one band. */
const joined = (first: Band, second: Band): Band | undefined => {
  const { low } = first;
  const { high } = second;
  if (first.high !== undefined || second.low !== undefined || low === undefined || high === undefined) return undefined;
  return first.unit === second.unit && low.value < high.value ? { low, high, unit: first.unit } : undefined;
};

/** The one band a text states (前年度のご宿泊数が30泊以上, 30 nights or more stayed last year), or undefined. */
export const bandIn = (written: string, words: BandWords): Band | undefined => {
  const text = normalizeBandText(written);
  const readings = readingsOf(text, words);
  const widest = readings.filter((reading) => !readings.some((other) => contains(other, reading))).toSorted((a, b) => a.from - b.from);
  const [first, second] = widest;
  if (first === undefined) return undefined;
  if (widest.length === 1) return first.band;
  return widest.length === 2 && second !== undefined && first.to <= second.from ? joined(first.band, second.band) : undefined;
};

const NEGATIVE: Edge = { value: Number.NEGATIVE_INFINITY, closed: false };
const POSITIVE: Edge = { value: Number.POSITIVE_INFINITY, closed: false };

const edgeOf = (bound: Bound): Edge => ({ value: bound.value, closed: bound.kind !== "exclusive" });

/** The edge where the next tier up starts closes this one: below 30 when the next starts at 30, up to 30 when it starts above it. */
const belowEdge = (next: Edge): Edge => ({ value: next.value, closed: !next.closed });

/** The tier below runs into the next one: it ends past where the next starts, or both hold the number they meet at. */
const overlaps = (below: Band, next: Edge): boolean => {
  if (below.high === undefined) return false;
  const end = edgeOf(below.high);
  return end.value > next.value || (end.value === next.value && end.closed && next.closed);
};

type Placed = { readonly entry: TierEntry; readonly band: Band; readonly low: Edge };

const placedTiers = (placed: readonly Placed[]): Tier[] | undefined => {
  const tiers = placed.map((tier, index): Tier | undefined => {
    const next = placed[index + 1];
    if (next !== undefined && (next.low.value === tier.low.value || overlaps(tier.band, next.low))) return undefined;
    if (tier.band.high !== undefined) return { ...tier, high: edgeOf(tier.band.high) };
    return { ...tier, high: next === undefined ? POSITIVE : belowEdge(next.low) };
  });
  return tiers.every((tier) => tier !== undefined) ? tiers : undefined;
};

const uniqueNames = (entries: readonly TierEntry[]): boolean => new Set(entries.map((entry) => plainKey(entry.name))).size === entries.length;

/**
 * The tiers of one table or list: at least two, each named once, each stating one band in one shared unit, and no two
 * bands holding one value. A tier written with its lower end only (20泊以上) runs up to where the next tier starts.
 */
export const tierSetOf = (entries: readonly TierEntry[], words: BandWords): TierSet | undefined => {
  if (entries.length < MIN_TIERS || !uniqueNames(entries) || entries.some((entry) => plainKey(entry.name) === "")) return undefined;
  const bands = entries.map((entry) => bandIn(entry.text, words));
  const units = new Set(bands.map((band) => band?.unit));
  const unit = [...units][0];
  if (units.size !== 1 || unit === undefined) return undefined;
  const placed = entries
    .flatMap((entry, index): Placed[] => {
      const band = bands[index];
      return band === undefined ? [] : [{ entry, band, low: band.low === undefined ? NEGATIVE : edgeOf(band.low) }];
    })
    .toSorted((a, b) => a.low.value - b.low.value);
  const tiers = placedTiers(placed);
  return tiers === undefined ? undefined : { unit, tiers };
};

const holds = (low: Edge, high: Edge, value: number): boolean =>
  (low.closed ? value >= low.value : value > low.value) && (high.closed ? value <= high.value : value < high.value);

/** The value as its band was written: 20泊以上 holds 35, though the tier above starts at 30. */
const inWrittenBand = (band: Band, value: number): boolean =>
  holds(band.low === undefined ? NEGATIVE : edgeOf(band.low), band.high === undefined ? POSITIVE : edgeOf(band.high), value);

type Figure = { readonly value: number; readonly unit: string };

/** A value that is one number in one tier unit and nothing else (42,400ポイント, 24 nights, $1,250). */
export const figureIn = (written: string, words: BandWords): Figure | undefined => {
  const text = plainKey(written);
  return words.units.flatMap((entry): Figure[] => {
    const unit = entry.pattern.normalize("NFKC").toLowerCase();
    const before = entry.position === "before";
    const holdsUnit = before ? text.startsWith(unit) : text.endsWith(unit);
    const digits = (before ? text.slice(unit.length) : text.slice(0, text.length - unit.length)).trim();
    return holdsUnit && FIGURE.test(digits) ? [{ value: Number(digits.replaceAll(",", "")), unit: unitKey(unit) }] : [];
  })[0];
};

type Statement = { readonly line: KeyValueLine; readonly name: string };

/** The one set naming the tier whose unit the section states exactly one value in, with that value. */
const comparedSet = (statement: Statement, sets: readonly TierSet[], text: TierText, words: TierWords) => {
  const lines = text.lines.filter((line) => line.section === statement.line.section && !words.others.some((word) => hasWord(plainKey(line.key), word)));
  const pairs = sets
    .filter((set) => set.tiers.some((tier) => nameKey(tier.entry.name) === statement.name))
    .flatMap((set) => {
      const values = lines.flatMap((line) => {
        const figure = figureIn(line.value, words.band);
        return figure !== undefined && figure.unit === set.unit ? [{ line, figure }] : [];
      });
      const [only] = values;
      return values.length === 1 && only !== undefined ? [{ set, ...only }] : [];
    });
  return pairs.length === 1 ? pairs[0] : undefined;
};

const slipOf = (statement: Statement, sets: readonly TierSet[], text: TierText, words: TierWords): TierSlip[] => {
  const compared = comparedSet(statement, sets, text, words);
  const stated = compared?.set.tiers.find((tier) => nameKey(tier.entry.name) === statement.name);
  if (compared === undefined || stated === undefined || inWrittenBand(stated.band, compared.figure.value)) return [];
  const actual = compared.set.tiers.find((tier) => holds(tier.low, tier.high, compared.figure.value));
  if (actual === undefined || actual === stated) return [];
  const values = { tier: stated.entry.name, band: stated.entry.text, value: compared.line.value, actual: actual.entry.name };
  return [{ offset: compared.line.valueStart, values }];
};

/** Each stated tier ("会員ランク：ゴールド") whose member's value of the tier's unit, in the same section, is outside its band. */
export const tierSlips = (text: TierText, words: TierWords): TierSlip[] => {
  const labels = new Set(words.labels.map(plainKey));
  const statements = text.lines.filter((line) => labels.has(plainKey(line.key))).map((line) => ({ line, name: nameKey(line.value) }));
  if (statements.length === 0) return [];
  const sets = text.tierRuns.flatMap((run) => tierSetOf(run, words.band) ?? []);
  return statements.flatMap((statement) => slipOf(statement, sets, text, words));
};
