// A breakdown written in one sentence (「構成比は、Aが50%、Bが30%、Cが20%」, "By product, A made up 50% of sales, B 30% and
// C 20%") whose shares do not add up to 100%. The table and list form is structure/percent-sum.ts; the words are the same.
import type { Span } from "../plugin.ts";
import type { StructureIssue } from "./issues.ts";
import type { Amount } from "./total.ts";
import type { ShareWords } from "./percent-sum.ts";

const WHOLE = 100;
/** A sentence names two shares in passing (「AとBで50%」); a breakdown in prose names at least three parts. */
const MIN_PARTS = 3;
/**
 * How far from 100% a sentence may add up and still read as one whole broken down. Far below it, the sentence names only the
 * larger parts (「Aが50%、Bが20%、Cが10%など」); far above it, the percentages are of different wholes ("55% of directors,
 * 48% of managers") or of two periods ("45% (40% last year)"), or the total is among them (「合計100%」).
 */
const BAND = 10;
const HALF = 0.5;
const DECIMAL_BASE = 10;
const DECIMALS = /\.(\d+)/u;
/** A sign before the number (+3%, ▲2%): a change, not a part. */
const SIGNS = "-+−▲△";

const includesAny = (text: string, words: readonly string[]): boolean => {
  const lowered = text.toLowerCase();
  return words.some((word) => lowered.includes(word.toLowerCase()));
};

const decimalsOf = (source: string, amount: Amount): number => DECIMALS.exec(source.slice(amount.offset, amount.end))?.[1]?.length ?? 0;

const isSigned = (source: string, amount: Amount): boolean => SIGNS.includes(source.slice(0, amount.offset).trimEnd().at(-1) ?? " ");

/** The rounding the parts allow: half the last digit each, at least one point. */
const toleranceOf = (source: string, shares: readonly Amount[]): number =>
  Math.max(1, shares.length * HALF * DECIMAL_BASE ** -Math.max(0, ...shares.map((share) => decimalsOf(source, share))));

const isBroken = (sum: number, tolerance: number): boolean => Math.abs(sum - WHOLE) > tolerance && Math.abs(sum - WHOLE) <= BAND;

/** How far before a percentage the word for the rest may stand: 「その他が 」, "and the rest, ". */
const REST_REACH = 16;
/** What may stand between the word for the rest and its percentage: a space, a colon, a particle, an opening parenthesis. */
const REST_GAP = /^[\s:：、,がはで(（]*$/u;
const LETTER_BEFORE = /\p{L}$/u;

/** One of the shares is the rest of the whole (その他が 5%, other 5%): only the parts of one whole have a rest. */
const namesRest = (source: string, sentence: Span, shares: readonly Amount[], rests: readonly string[]): boolean =>
  shares.some((share) => {
    const before = source.slice(Math.max(sentence.start, share.offset - REST_REACH), share.offset).toLowerCase();
    return rests.some((word) => {
      const at = before.lastIndexOf(word.toLowerCase());
      if (at < 0 || !REST_GAP.test(before.slice(at + word.length))) return false;
      return !(/^[A-Za-z]/u.test(word) && LETTER_BEFORE.test(before.slice(0, at)));
    });
  });

const issueIn = (source: string, sentence: Span, percents: readonly Amount[], words: ShareWords): StructureIssue[] => {
  const text = source.slice(sentence.start, sentence.end);
  if (includesAny(text, words.exceptions)) return [];
  const shares = percents.filter((amount) => amount.offset >= sentence.start && amount.end <= sentence.end);
  if (shares.length < MIN_PARTS || shares.some((share) => isSigned(source, share))) return [];
  if (!includesAny(text, words.labels) && !namesRest(source, sentence, shares, words.rests ?? [])) return [];
  const sum = shares.reduce((total, share) => total + share.value, 0);
  const decimals = Math.max(0, ...shares.map((share) => decimalsOf(source, share)));
  if (!isBroken(sum, toleranceOf(source, shares))) return [];
  return [{ offset: shares[0]?.offset ?? sentence.start, values: { sum: `${sum.toFixed(decimals)}${shares[0]?.unit ?? ""}` } }];
};

/** Each sentence that names a share word (or names one share as the rest) and three or more unsigned percentages whose sum misses 100% by more than rounding, and by no more than BAND. */
export const proseShareMismatches = (source: string, sentences: readonly Span[], amounts: readonly Amount[], words: ShareWords): StructureIssue[] => {
  if (words.labels.length === 0 && (words.rests ?? []).length === 0) return [];
  const percents = amounts.filter((amount) => words.units.includes(amount.unit));
  return sentences.flatMap((sentence) => issueIn(source, sentence, percents, words));
};
