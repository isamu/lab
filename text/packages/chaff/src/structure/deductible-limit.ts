import { escapeRegExp } from "../orthography.ts";
import { keyOf, proseValues, type AmountWords, type Figure } from "./ratio.ts";

/**
 * deductible-exceeds-limit: the deciding half. In one sentence naming one deductible (免責金額, excess) and one limit
 * (支払限度額, the most we pay), each with one amount of money right after it, a deductible larger than the limit for a
 * comparable basis (1回, a claim, 1品, a single item) means the benefit pays nothing. The words are lexicons; nothing here
 * knows a word of insurance. Pure.
 */

/** A basis an amount is stated for (1回, a visit, 1品). rank orders the bases that nest: a claim holds one item or more. */
export type BasisWord = { readonly pattern: string; readonly basis: string; readonly rank?: number | undefined };

export type DeductibleWords = {
  readonly deductibles: readonly string[];
  readonly limits: readonly string[];
  /** Phrases holding a deductible word without naming a deductible ("in excess of", 自己負担限度額). */
  readonly notDeductibles: readonly string[];
  /** Phrases holding a limit word without naming the most paid ("maximum excess"). */
  readonly notLimits: readonly string[];
  readonly bases: readonly BasisWord[];
  readonly approximate: { readonly before: readonly string[]; readonly after: readonly string[] };
  readonly rangeMarks: readonly string[];
  /** Words of magnitude and what they multiply by (万 is 10000, million). */
  readonly multipliers: readonly { readonly word: string; readonly value: number }[];
  readonly amounts: AmountWords;
  /** Which currency each mark names ($ and US$ are both USD; 円 and ¥ are both JPY). */
  readonly currencies: readonly { readonly pattern: string; readonly currency: string }[];
};

export type Basis = { readonly basis: string; readonly rank?: number | undefined };

/** An amount as stated: its value in the currency's own unit, the currency (with the magnitude word taken out), the basis. */
export type StatedAmount = { readonly value: number; readonly currency: string; readonly basis?: Basis | undefined };

export type DeductibleIssue = { readonly offset: number; readonly values: Readonly<Record<string, string>> };

/**
 * Whether a deductible on one basis can be held against a limit on another. A limit with no basis is the most ever paid, so
 * every deductible is held against it. The same basis is. A deductible on a basis that holds the limit's (an excess per
 * claim, a limit per item) is: a claim for one item meets the whole excess and at most one item's limit. A deductible with no
 * basis is charged on one claim, so it is held against a limit on any basis that nests. Bases that do not nest (a day, a
 * year) are compared only with themselves.
 */
export const basesComparable = (deductible: Basis | undefined, limit: Basis | undefined): boolean => {
  if (limit === undefined) return true;
  if (deductible === undefined) return limit.rank !== undefined;
  if (deductible.basis === limit.basis) return true;
  return deductible.rank !== undefined && limit.rank !== undefined && deductible.rank > limit.rank;
};

/** A deductible larger than the limit, in the same currency, on comparable bases. An equal one is not reported. */
export const deductibleExceeds = (deductible: StatedAmount, limit: StatedAmount): boolean =>
  deductible.currency === limit.currency && basesComparable(deductible.basis, limit.basis) && deductible.value > limit.value;

/** How far after its word an amount may start (「免責金額は1回」, "the most we pay for a single item is"). */
const MAX_GAP = 24;
/** How far around a word and its amount the basis is looked for, in characters. */
const BASIS_REACH = 16;
/** Marks that end a clause: a basis is not read across them. */
const CLAUSE_BREAK = /[、,;；，。.]/u;
const NUMBER_AT = /^\d+(?:,\d{3})*(?:\.\d+)?/u;
const LATIN = /^[A-Za-z]/u;
const DIGIT_START = /^\d/u;
const DIGIT_BEFORE = /[\d.,]$/u;
const CJK_LETTER = /[\p{sc=Han}\p{sc=Katakana}ー]/u;
const LETTER = /\p{L}/u;

type Hit = { readonly start: number; readonly end: number; readonly kind: "deductible" | "limit"; readonly word: string };
type Spot = { readonly start: number; readonly end: number };

/** Where a word stands: a Latin word as a whole word in any case, any other word not inside a longer kanji or katakana word. */
const spansOf = (text: string, word: string, cjkBounded: boolean): Spot[] => {
  if (word === "") return [];
  const latin = LATIN.test(word);
  const pattern = new RegExp(latin ? `(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])` : escapeRegExp(word), latin ? "giu" : "gu");
  return [...text.matchAll(pattern)]
    .filter((match) => {
      const [before, after] = [text.charAt(match.index - 1), text.charAt(match.index + match[0].length)];
      if (DIGIT_START.test(word) && DIGIT_BEFORE.test(text.slice(0, match.index))) return false;
      return latin || !cjkBounded || !(CJK_LETTER.test(before) || CJK_LETTER.test(after));
    })
    .map((match) => ({ start: match.index, end: match.index + match[0].length }));
};

const within = (outer: Spot) => (inner: Spot) => outer.start <= inner.start && inner.end <= outer.end;

/** The deductible and limit words of a sentence, without those inside a not-phrase or inside a longer word found. */
const hitsIn = (text: string, words: DeductibleWords): Hit[] => {
  const nots = {
    deductible: words.notDeductibles.flatMap((word) => spansOf(text, word, false)),
    limit: words.notLimits.flatMap((word) => spansOf(text, word, false)),
  };
  const all = [
    ...words.deductibles.flatMap((word) => spansOf(text, word, true).map((at): Hit => ({ ...at, kind: "deductible", word: text.slice(at.start, at.end) }))),
    ...words.limits.flatMap((word) => spansOf(text, word, true).map((at): Hit => ({ ...at, kind: "limit", word: text.slice(at.start, at.end) }))),
  ];
  return all.filter(
    (hit) =>
      !nots[hit.kind].some((not) => within(not)(hit)) &&
      !all.some((other) => other !== hit && within(other)(hit) && other.end - other.start > hit.end - hit.start),
  );
};

/** The written text of an amount: its currency mark before, its number, its unit after (as long as the unit read). */
type Written = Spot & { readonly figure: Figure };

const writtenOf = (text: string, figure: Figure): Written | undefined => {
  const [prefix = "", unit = ""] = figure.unit.split("|");
  const number = NUMBER_AT.exec(text.slice(figure.start));
  if (number === null) return undefined;
  const afterNumber = figure.start + number[0].length;
  const gap = unit === "" ? 0 : text.slice(afterNumber).length - text.slice(afterNumber).trimStart().length;
  return { start: figure.start - prefix.length, end: afterNumber + (unit === "" ? 0 : gap + unit.length), figure };
};

const lower = (text: string): string => text.toLowerCase();

/** A mark at the end of before (or the start of after) standing as a word of its own when it is Latin. */
const endsWithMark = (before: string, mark: string): boolean => {
  const at = lower(before).lastIndexOf(lower(mark));
  return at >= 0 && at + mark.length === before.length && !(LATIN.test(mark) && LETTER.test(before.charAt(at - 1)));
};
const startsWithMark = (after: string, mark: string): boolean =>
  lower(after).startsWith(lower(mark)) && !(LATIN.test(mark) && LETTER.test(after.charAt(mark.length)));

/** A rough amount (約5,000円, about $80, 5,000円程度) or one end of a range (1,000〜5,000円, $50 - $80). A limit word is not rough. */
const isRoughOrRange = (text: string, written: Written, words: DeductibleWords): boolean => {
  const before = text.slice(0, written.start).trimEnd();
  const after = text.slice(written.end).trimStart();
  const limitWords = new Set(words.limits.map(lower));
  const rough = [
    ...words.approximate.before.filter((mark) => !limitWords.has(lower(mark)) && endsWithMark(before, mark)),
    ...words.approximate.after.filter((mark) => startsWithMark(after, mark)),
  ];
  return rough.length > 0 || words.rangeMarks.some((mark) => before.endsWith(mark) || after.startsWith(mark));
};

/** The currency a mark names, or the mark itself when no lexicon entry names one. */
const currencyOf = (mark: string, words: DeductibleWords): string => words.currencies.find((entry) => keyOf(entry.pattern) === mark)?.currency ?? mark;

/** The value with its word of magnitude multiplied in, and the currency its marks name ("|万円" 30 is 300000 JPY, "us$|" is USD). */
const scaled = (figure: Figure, words: DeductibleWords): { value: number; currency: string } => {
  const [prefix = "", unit = ""] = figure.unit.split("|");
  const multiplier = words.multipliers.find((entry) => unit.startsWith(keyOf(entry.word)));
  const bare = multiplier === undefined ? unit : unit.slice(keyOf(multiplier.word).length).trimStart();
  const marks = [prefix, bare].filter((mark) => mark !== "").map((mark) => currencyOf(mark, words));
  return { value: figure.value * (multiplier?.value ?? 1), currency: [...new Set(marks)].join("|") };
};

/** The only amount of money between a word and the next word (or the end), close to it. */
const amountAfter = (hit: Hit, hits: readonly Hit[], figures: readonly Figure[], text: string): Written | undefined => {
  const until = Math.min(text.length, ...hits.filter((other) => other.start >= hit.end).map((other) => other.start));
  const between = figures.filter((figure) => figure.start >= hit.end && figure.start < until);
  const only = between.length === 1 ? between[0] : undefined;
  if (only === undefined || only.start - hit.end > MAX_GAP) return undefined;
  return writtenOf(text, only);
};

const lastBreakBefore = (text: string, at: number): number => {
  const before = text.slice(0, at);
  const breaks = [...before.matchAll(new RegExp(CLAUSE_BREAK.source, "gu"))].map((match) => match.index + 1);
  return Math.max(0, ...breaks);
};

const firstBreakAfter = (text: string, at: number): number => {
  const found = CLAUSE_BREAK.exec(text.slice(at));
  return found === null ? text.length : at + found.index;
};

/** The bases written in the clause around a word and its amount, outside the amount itself. */
const basesIn = (text: string, region: Spot, words: DeductibleWords, taken: Spot): BasisWord[] => {
  const slice = text.slice(region.start, region.end);
  return words.bases.flatMap((entry) =>
    spansOf(slice, entry.pattern, false)
      .map((at) => ({ start: region.start + at.start, end: region.start + at.end }))
      .filter((at) => !(at.start < taken.end && taken.start < at.end))
      .map(() => entry),
  );
};

type Read = { readonly hit: Hit; readonly written: Written; readonly stated: StatedAmount };

const SPACES = /^\s*/u;

/** Where the bases written right after an amount end ("$80 a visit", "$80 a visit a day"), or the amount's end when none is. */
const adjacentEnd = (text: string, end: number, words: DeductibleWords): number => {
  const from = end + (SPACES.exec(text.slice(end))?.[0].length ?? 0);
  const rest = text.slice(from);
  const lengths = words.bases.flatMap((entry) =>
    spansOf(rest, entry.pattern, false)
      .filter((at) => at.start === 0)
      .map((at) => at.end),
  );
  return lengths.length === 0 ? end : adjacentEnd(text, from + Math.max(...lengths), words);
};

/**
 * The clause around a word and its amount where its basis is read. Between the first amount and the second word, only a basis
 * right after the amount is the first's ("$80 a visit and the most we pay"); any other belongs to the second word
 * (「300,000円で1品あたりの支払限度額」).
 */
const regionsOf = (text: string, first: Written, second: { hit: Hit; written: Written }, firstHit: Hit, words: DeductibleWords): [Spot, Spot] => {
  const split = adjacentEnd(text, first.end, words);
  const opening = { start: Math.max(firstHit.start - BASIS_REACH, lastBreakBefore(text, firstHit.start)), end: split };
  const closing = {
    start: Math.max(split, second.hit.start - BASIS_REACH, lastBreakBefore(text, second.hit.start)),
    end: Math.min(second.written.end + BASIS_REACH, firstBreakAfter(text, second.written.end)),
  };
  return [opening, closing];
};

/** The amount as stated, with the one basis written around it; two different bases leave it unread. */
const statedOf = (text: string, written: Written, region: Spot, words: DeductibleWords): StatedAmount | undefined => {
  const found = basesIn(text, region, words, written);
  if (new Set(found.map((entry) => entry.basis)).size > 1) return undefined;
  const first = found[0];
  return { ...scaled(written.figure, words), basis: first === undefined ? undefined : { basis: first.basis, rank: first.rank } };
};

/** Both words with their amounts and bases, in the order written; undefined when either amount is not read. */
const readPair = (text: string, hits: readonly [Hit, Hit], figures: readonly Figure[], words: DeductibleWords): Read[] | undefined => {
  const [first, second] = hits.toSorted((left, right) => left.start - right.start);
  if (first === undefined || second === undefined) return undefined;
  const [firstWritten, secondWritten] = [amountAfter(first, hits, figures, text), amountAfter(second, hits, figures, text)];
  if (firstWritten === undefined || secondWritten === undefined) return undefined;
  if ([firstWritten, secondWritten].some((written) => isRoughOrRange(text, written, words))) return undefined;
  const [opening, closing] = regionsOf(text, firstWritten, { hit: second, written: secondWritten }, first, words);
  const [firstStated, secondStated] = [statedOf(text, firstWritten, opening, words), statedOf(text, secondWritten, closing, words)];
  if (firstStated === undefined || secondStated === undefined) return undefined;
  return [
    { hit: first, written: firstWritten, stated: firstStated },
    { hit: second, written: secondWritten, stated: secondStated },
  ];
};

/**
 * One sentence (text, starting at offset in the document) with exactly one deductible word and one limit word, each with one
 * amount of money right after it, read as stated and compared. Any other shape is not read.
 */
export const sentenceDeductibleOverLimit = (text: string, offset: number, words: DeductibleWords): DeductibleIssue | undefined => {
  const hits = hitsIn(text, words);
  const deductibleHits = hits.filter((hit) => hit.kind === "deductible");
  const limitHits = hits.filter((hit) => hit.kind === "limit");
  const [deductibleHit, limitHit] = [deductibleHits[0], limitHits[0]];
  if (deductibleHits.length !== 1 || limitHits.length !== 1 || deductibleHit === undefined || limitHit === undefined) return undefined;
  const { figures } = proseValues(text, 0, words.amounts);
  const pair = readPair(text, [deductibleHit, limitHit], figures, words);
  const deductible = pair?.find((read) => read.hit === deductibleHit);
  const limit = pair?.find((read) => read.hit === limitHit);
  if (deductible === undefined || limit === undefined || !deductibleExceeds(deductible.stated, limit.stated)) return undefined;
  const shown = (read: Read): string => text.slice(read.written.start, read.written.end);
  return {
    offset: offset + deductible.written.start,
    values: { deductibleWord: deductible.hit.word, deductible: shown(deductible), limitWord: limit.hit.word, limit: shown(limit) },
  };
};
