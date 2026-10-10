import type { StructureIssue } from "./issues.ts";
import { alternation, intervalOf, isMultiple, isPlainGap, nearestStated, occurrences, type Interval, type Span, type StatedAmount } from "./stated-multiple.ts";

/**
 * period-multiple-mismatch: an amount the text says is a number of another period's amount that is not that many of it
 * (年払（月払の12か月分） 29,800円 with 月払 2,400円; "Annually (12 monthly payments) $298" with Monthly $24). Only an
 * explicit statement is read: the base's own word beside a count and a word of a multiple (月払の12か月分, 12 times the
 * monthly premium, 12 monthly payments). An annual amount that only stands beside a monthly one is not compared, since
 * paying at once is often cheaper. The base is the nearest one stated before (one label, one amount), else the document's
 * one base. A range of counts, a statement with two amounts, and a statement with a word that makes the amount another
 * thing (割引, tax, each) are not compared. The words come from the lexicons. Pure.
 */

export type PeriodMultipleWords = {
  /** Labels of the base amount, also its words in a multiple (月払, 月額, Monthly, monthly payments). */
  readonly bases: readonly string[];
  /** Words after a count that make it a multiple (か月分, 倍, times). */
  readonly times: readonly string[];
  /** Words that may stand between a base and its count (の, the), or between a base label and its amount (は, is). */
  readonly links: readonly string[];
  /** Words that make the amount something other than the plain multiple (割引, 税込, discount, each). */
  readonly skips: readonly string[];
  /** Marks and words that join the two ends of a range (〜, to). */
  readonly connectors: readonly string[];
  /** Numbers written as words (twelve, 十二) and their values. */
  readonly numberWords: readonly { readonly word: string; readonly value: number }[];
};

/** A count read as a multiple of a base (月払の12か月分, 12 monthly payments). */
export type Phrase = Span & { readonly count: number };

/** A base as stated. range is undefined when its statement holds more than one amount or a word that makes it another. */
type Base = { readonly offset: number; readonly label: string; readonly currency: string; readonly range: Interval | undefined; readonly written: string };

type Count = Span & { readonly count: number; readonly timed: boolean };

const DIGITS = "[0-9０-９]+(?:[.．][0-9０-９]+)?";
/** A count right after one of these is the tail of a larger number (十二, 二百), not a count of its own. */
const KANJI_NUMERALS = "〇零一二三四五六七八九十百千万";
const RANGE_START_DIGIT = /[0-9０-９一二三四五六七八九十]\s*$/u;
const SENTENCE_END = /[。！？；;]|[.!?](?=\s|$)/gu;
/** Between a phrase and its amount only marks may stand: brackets, a cell's bar, a colon (（月払の12か月分） | 29,800円). */
const MARKS_ONLY = /^[\s|｜:：=＝、，,()（）[\]［］]*$/u;
const SPACES_ONLY = /^[ \t\u3000]+$/u;
/** How far before a count the start of a range (11〜12か月分) is looked for. */
const RANGE_REACH = 12;

const lineBounds = (text: string, offset: number): Span => {
  const end = text.indexOf("\n", offset);
  return { start: text.lastIndexOf("\n", offset - 1) + 1, end: end === -1 ? text.length : end };
};

/** The sentence around a span, within its line. */
export const sentenceAround = (text: string, span: Span): Span => {
  const line = lineBounds(text, span.start);
  const ends = [...text.slice(line.start, line.end).matchAll(SENTENCE_END)].map((match) => line.start + match.index);
  const start = ends.filter((end) => end < span.start).at(-1);
  const end = ends.find((at) => at >= span.end);
  return { start: start === undefined ? line.start : start + 1, end: end ?? line.end };
};

const countOf = (written: string, words: PeriodMultipleWords): number =>
  words.numberWords.find((entry) => entry.word.toLowerCase() === written.toLowerCase())?.value ?? Number(written.normalize("NFKC"));

/** Every count in the text (12, twelve), marked when a word of a multiple follows it (12か月分, 12 times). */
export const countsIn = (text: string, words: PeriodMultipleWords): Count[] => {
  const numberWords = alternation(words.numberWords.map((entry) => entry.word));
  const count = numberWords === undefined ? DIGITS : `${DIGITS}|${numberWords}`;
  const times = alternation(words.times);
  const tail = times === undefined ? "" : `(\\s?(?:${times}))?`;
  const pattern = new RegExp(`(?<![0-9０-９.,，．${KANJI_NUMERALS}])(${count})(?![0-9０-９]|[.,，．][0-9０-９])${tail}`, "giu");
  return [...text.matchAll(pattern)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    count: countOf(match[1] ?? "", words),
    timed: match[2] !== undefined,
  }));
};

/** Whether only link words and spaces stand between a base word and its count, on one line (の, " the "). */
const isLinkGap = (gap: string, words: PeriodMultipleWords): boolean => {
  if (gap.includes("\n")) return false;
  const pattern = alternation(words.links);
  return (pattern === undefined ? gap : gap.replace(new RegExp(pattern, "giu"), "")).trim() === "";
};

/** Whether a count closes a range: a connector right before it with a number before that (11〜12, eleven to twelve; not "equal to 12"). */
const endsRange = (text: string, count: Count, words: PeriodMultipleWords): boolean => {
  const before = text.slice(Math.max(0, count.start - RANGE_REACH), count.start).trimEnd();
  const endsNumber = (head: string): boolean =>
    RANGE_START_DIGIT.test(head) || countsIn(head.trimEnd(), words).some((found) => found.end === head.trimEnd().length);
  return words.connectors.some((connector) => before.toLowerCase().endsWith(connector.toLowerCase()) && endsNumber(before.slice(0, -connector.length)));
};

/** The base word a count is a multiple of: before it with a word of a multiple (月払の12か月分), or after it (12 monthly payments). */
const baseOf = (text: string, count: Count, bases: readonly Span[], words: PeriodMultipleWords): Span | undefined => {
  const after = bases.find(
    (base) =>
      base.start >= count.end && (count.timed ? isLinkGap(text.slice(count.end, base.start), words) : SPACES_ONLY.test(text.slice(count.end, base.start))),
  );
  if (after !== undefined) return after;
  return count.timed ? bases.findLast((base) => base.end <= count.start && isLinkGap(text.slice(base.end, count.start), words)) : undefined;
};

/** Every count stated as a multiple of a base word (月払の12か月分, 12 times the monthly premium, 12 monthly payments). */
export const phrasesIn = (text: string, words: PeriodMultipleWords): Phrase[] => {
  const bases = occurrences(text, words.bases);
  return countsIn(text, words).flatMap((count) => {
    const base = baseOf(text, count, bases, words);
    if (base === undefined || endsRange(text, count, words)) return [];
    return [{ start: Math.min(base.start, count.start), end: Math.max(base.end, count.end), count: count.count }];
  });
};

const amountsWithin = (amounts: readonly StatedAmount[], span: Span): StatedAmount[] =>
  amounts.filter((amount) => amount.offset >= span.start && amount.end <= span.end);

const inside = (phrases: readonly Phrase[], offset: number): boolean => phrases.some((phrase) => offset >= phrase.start && offset < phrase.end);

/** A base label followed on its line by an amount (月払 | 2,400円, Monthly: $24); unclear when the sentence holds more. */
const baseAt = (text: string, label: Span, amounts: readonly StatedAmount[], phrases: readonly Phrase[], words: PeriodMultipleWords): Base[] => {
  const sentence = sentenceAround(text, label);
  const [first, ...rest] = amountsWithin(amounts, { start: label.end, end: sentence.end });
  if (first === undefined || !isPlainGap(text.slice(label.end, first.offset), words.links)) return [];
  const written = text.slice(first.offset, first.end);
  const statement = text.slice(sentence.start, sentence.end);
  const unclear =
    rest.length > 0 || occurrences(statement, words.skips).length > 0 || phrases.some((phrase) => phrase.start >= sentence.start && phrase.end <= sentence.end);
  const range = unclear ? undefined : intervalOf(first, written);
  return [{ offset: label.start, label: text.slice(label.start, label.end), currency: first.currency, range, written }];
};

/** Each base label outside a multiple that is followed by its amount, in document order. */
const statedBases = (text: string, amounts: readonly StatedAmount[], phrases: readonly Phrase[], words: PeriodMultipleWords): Base[] =>
  occurrences(text, words.bases)
    .filter((label) => !inside(phrases, label.start))
    .flatMap((label) => baseAt(text, label, amounts, phrases, words));

const gapBetween = (text: string, phrase: Phrase, amount: StatedAmount): string =>
  amount.offset >= phrase.end ? text.slice(phrase.end, amount.offset) : text.slice(amount.end, phrase.start);

/** The one amount a phrase's sentence states beside it, when the sentence holds no other amount, phrase or skip word. */
const multipleAmount = (
  text: string,
  phrase: Phrase,
  phrases: readonly Phrase[],
  amounts: readonly StatedAmount[],
  words: PeriodMultipleWords,
): StatedAmount | undefined => {
  const sentence = sentenceAround(text, phrase);
  const [amount, ...rest] = amountsWithin(amounts, sentence);
  if (amount === undefined || rest.length > 0 || (amount.offset < phrase.end && amount.end > phrase.start)) return undefined;
  const others = phrases.some((other) => other !== phrase && other.start >= sentence.start && other.end <= sentence.end);
  if (others || occurrences(text.slice(sentence.start, sentence.end), words.skips).length > 0) return undefined;
  return MARKS_ONLY.test(gapBetween(text, phrase, amount)) ? amount : undefined;
};

const mismatchOf = (
  text: string,
  phrase: Phrase,
  phrases: readonly Phrase[],
  amounts: readonly StatedAmount[],
  bases: readonly Base[],
  words: PeriodMultipleWords,
): StructureIssue[] => {
  const amount = multipleAmount(text, phrase, phrases, amounts, words);
  const base = nearestStated(bases, phrase.start);
  if (amount === undefined || base?.range === undefined || base.currency !== amount.currency) return [];
  if (isMultiple(phrase.count, intervalOf(amount, text.slice(amount.offset, amount.end)), [base.range])) return [];
  const values = {
    multiple: text.slice(phrase.start, phrase.end),
    amount: text.slice(amount.offset, amount.end),
    label: base.label,
    base: base.written,
    count: phrase.count,
  };
  return [{ offset: Math.min(phrase.start, amount.offset), values }];
};

/** Every amount stated as a number of a base's amount (月払の12か月分) that is not that many of the nearest stated base. */
export const periodMultipleMismatches = (text: string, amounts: readonly StatedAmount[], words: PeriodMultipleWords): StructureIssue[] => {
  const phrases = phrasesIn(text, words);
  if (phrases.length === 0) return [];
  const bases = statedBases(text, amounts, phrases, words);
  return phrases.flatMap((phrase) => mismatchOf(text, phrase, phrases, amounts, bases, words));
};
