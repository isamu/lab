// How a document writes its numbers: 3件 or 三件, 1,000 or 1000, 10% or 10％ or 10パーセント, three files or 3 files.
// Each kind is compared within the document and the less common style is reported; neither is called right. Pure; the
// words (counters, kanji numerals, percent units, number words) come from the language's lexicons.
import { escapeRegExp } from "../orthography.ts";
import { QUOTATION_MARKS, isWithinAny, quotedSpans } from "../quoted-span.ts";
import { isCitation } from "./kutoten-consistency.ts";
import type { Detector, Finding, ProseDocument, Sentence, Span, Token } from "../plugin.ts";

export type NumberKind = "count" | "grouping" | "percent" | "count-small" | "count-large";

/** One number as written: its kind, the style it is written in, the text, and where it starts in the document. */
export type NumberMark = { readonly kind: NumberKind; readonly style: string; readonly written: string; readonly offset: number };

/** The language's words for numbers. countWords is in order from one (the position is the value). */
export type NumberWords = {
  readonly counters: readonly string[];
  readonly kanji: readonly string[];
  readonly percentUnits: readonly string[];
  readonly countWords: readonly string[];
  /** Plural nouns of measure (days, miles) that take figures in every style: a number before one is not a count. */
  readonly figureNouns: readonly string[];
};

const alternation = (words: readonly string[]): string =>
  words
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");

const DIGIT_RUN = "[0-9０-９]+(?:[,，.．][0-9０-９]+)*";

// ───────── counts in Japanese: 3件 or 三件 ─────────

/**
 * A number right before a counter. Not after a kanji, a kana prolonged mark or 第 (統一, 唯一, 第三回 are words or ordinals),
 * nor after a letter or digit (part of a code).
 */
const countPattern = (words: NumberWords): RegExp | undefined => {
  if (words.counters.length === 0 || words.kanji.length === 0) return undefined;
  const kanji = `[${words.kanji.map(escapeRegExp).join("")}]+`;
  return new RegExp(`(?<![\\p{Script=Han}A-Za-z0-9０-９.．])(?:(${DIGIT_RUN}[万億]?)|(${kanji}))\\s?(?:${alternation(words.counters)})`, "gu");
};

/**
 * 一 alone is the idiom (一つ, 一人, 一回) a document writes in kanji whatever its style for counts. A run of magnitudes only
 * (万人, 百人一首, 千人) is as often a word as a number.
 */
const MAGNITUDES = /^[一百千万億]+$/u;

const isIdiomNumeral = (numeral: string): boolean => MAGNITUDES.test(numeral);

const countMarks = (text: string, base: number, words: NumberWords): NumberMark[] => {
  const pattern = countPattern(words);
  if (pattern === undefined) return [];
  return [...text.matchAll(pattern)].flatMap((match): NumberMark[] => {
    const [written, digits, kanji] = match;
    if (kanji !== undefined && isIdiomNumeral(kanji)) return [];
    return [{ kind: "count", style: digits === undefined ? "kanji" : "digits", written, offset: base + match.index }];
  });
};

// ───────── digit grouping: 1,000 or 1000 ─────────

const GROUPED = /^[0-9０-９]{1,3}(?:[,，][0-9０-９]{3})+$/u;

const DIGITS_AND_COMMAS = /[0-9０-９]+(?:[,，][0-9０-９]+)*/gu;
const PLAIN_BIG = /^[1-9１-９][0-9０-９]{3,}$/u;

/** Next to one of these, a run of digits is part of a code, a version, a date, a time, a phone number or a decimal. */
const NOT_BEFORE = /[\p{L}\p{N}.,，．#＃/:：\-－_]/u;
const NOT_AFTER = /[\p{N}.,，．:：\-－/]/u;

type DigitRun = { readonly written: string; readonly index: number };

/** Each number of four digits or more standing alone, grouped (1,000) or not (1000). */
const bigNumbers = (text: string): DigitRun[] =>
  [...text.matchAll(DIGITS_AND_COMMAS)].flatMap((match): DigitRun[] => {
    const written = match[0];
    const standsAlone = !NOT_BEFORE.test(text.charAt(match.index - 1)) && !NOT_AFTER.test(text.charAt(match.index + written.length));
    return standsAlone && (GROUPED.test(written) || PLAIN_BIG.test(written)) ? [{ written, index: match.index }] : [];
  });

const CURRENCY_BEFORE = /[$¥￥€£]\s?$/u;

/** A capitalised word or abbreviation right before (H.R. 5376, Form 1040, No. 12345): the number is a label, never grouped. */
const isLabelBefore = (before: string): boolean => /\s$/u.test(before) && /^\p{Lu}/u.test(before.trimEnd().split(/\s/u).at(-1) ?? "");

/** A four-digit number in this range is most often a year (2019 annual report), which is never grouped. */
const YEAR_LIKE = { from: 1000, to: 2199 };

const FOUR_DIGITS = 4;

const isYearLike = (digits: string): boolean => {
  const value = Number(digits.normalize("NFKC"));
  return digits.length === FOUR_DIGITS && value >= YEAR_LIKE.from && value <= YEAR_LIKE.to;
};

/** What follows a quantity: a counter or 円 / 万 (Japanese), or a word in lower case (10000 users). */
/** A counter or 円 / 万 / 億 right after (with at most one space): the number counts something in Japanese. */
const countedAfter = (after: string, words: NumberWords): boolean => {
  const next = after.replace(/^\s/u, "");
  return /^[万億円]/u.test(next) || words.counters.some((counter) => next.startsWith(counter));
};

/** What follows a quantity: a Japanese counter, or a word in lower case (10000 users). */
const quantityAfter = (after: string, words: NumberWords): boolean => /^\s?[a-z]/u.test(after) || countedAfter(after, words);

/** How far back to look for a currency sign or a label word. The sentence may start right after one (H.R. ends a sentence). */
const BEFORE_REACH = 16;

const groupingMarks = (text: string, base: number, words: NumberWords, source: string): NumberMark[] =>
  bigNumbers(text).flatMap(({ written, index }): NumberMark[] => {
    const grouped = GROUPED.test(written);
    const before = source.slice(Math.max(0, base + index - BEFORE_REACH), base + index);
    const after = text.slice(index + written.length);
    const currency = CURRENCY_BEFORE.test(before);
    if (!currency && !quantityAfter(after, words)) return [];
    if (!grouped && isLabelBefore(before)) return [];
    if (!grouped && !currency && isYearLike(written) && !countedAfter(after, words)) return [];
    return [{ kind: "grouping", style: grouped ? "grouped" : "plain", written, offset: base + index }];
  });

// ───────── percent: 10% or 10％ or 10パーセント, 10% or 10 percent ─────────

const percentMarks = (text: string, base: number, words: NumberWords): NumberMark[] => {
  if (words.percentUnits.length === 0) return [];
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}.．,，])(${DIGIT_RUN})\\s?(${alternation(words.percentUnits)})(?![A-Za-z])`, "gu");
  return [...text.matchAll(pattern)].map((match) => ({
    kind: "percent",
    style: (match[2] ?? "").toLowerCase(),
    written: match[0],
    offset: base + match.index,
  }));
};

// ───────── counts in English: three files or 3 files ─────────

const SMALL_FROM = 2;
const LARGE_FROM = 10;

const valueOf = (surface: string, words: readonly string[]): number | undefined => {
  if (/^\d+$/u.test(surface)) return Number(surface);
  const at = words.indexOf(surface.toLowerCase());
  return at === -1 ? undefined : at + 1;
};

const isCountedNoun = (token: Token | undefined, figureNouns: readonly string[]): boolean =>
  token?.pos === "NOUN" && token.features?.["Number"] === "Plur" && !figureNouns.includes(token.surface.toLowerCase());

/**
 * A number before a plural noun (three files, 3 files), from two to the last number word the language lists. One is a
 * pronoun as often as a count. A number word that opens the sentence is spelt out by every style, so it is not counted.
 */
const englishCountMarks = (sentence: Sentence, words: NumberWords): NumberMark[] => {
  const tokens = sentence.tokens ?? [];
  return tokens.flatMap((token, index): NumberMark[] => {
    const value = valueOf(token.surface, words.countWords);
    if (value === undefined || value < SMALL_FROM || value > words.countWords.length || index === 0 || !isCountedNoun(tokens[index + 1], words.figureNouns))
      return [];
    const style = /^\d+$/u.test(token.surface) ? "digits" : "words";
    return [{ kind: value < LARGE_FROM ? "count-small" : "count-large", style, written: token.surface, offset: sentence.span.start + token.span.start }];
  });
};

// ───────── the document ─────────

/** Every number mark in a sentence, less those inside a quotation. */
export const numberMarksIn = (sentence: Sentence, words: NumberWords, language: string, source: string): NumberMark[] => {
  const base = sentence.span.start;
  const marks = [
    ...countMarks(sentence.text, base, words),
    ...groupingMarks(sentence.text, base, words, source),
    ...percentMarks(sentence.text, base, words),
    ...(language === "ja" ? [] : englishCountMarks(sentence, words)),
  ];
  const quoted: readonly Span[] = quotedSpans(sentence.text, QUOTATION_MARKS);
  return marks.filter((mark) => !isWithinAny(quoted, { start: mark.offset - base, end: mark.offset - base + mark.written.length }));
};

const PERCENT = 100;

/**
 * The marks not in the document's usual style, when they are few enough to be slips: at most limitPercent of the kind.
 * The usual style is the most common one; on a tie, the one the document used first.
 */
export const minorityStyles = (marks: readonly NumberMark[], limitPercent: number): { readonly odd: NumberMark[]; readonly usual: NumberMark | undefined } => {
  const counts = new Map<string, number>();
  marks.forEach((mark) => counts.set(mark.style, (counts.get(mark.style) ?? 0) + 1));
  if (counts.size < 2) return { odd: [], usual: undefined };
  const most = Math.max(...counts.values());
  const usual = marks.find((mark) => counts.get(mark.style) === most);
  const odd = marks.filter((mark) => mark.style !== usual?.style);
  return odd.length * PERCENT > limitPercent * marks.length ? { odd: [], usual } : { odd, usual };
};

const wordsOf = (doc: ProseDocument): NumberWords => {
  const patterns = (id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);
  return {
    counters: patterns("numeral-counter"),
    kanji: patterns("numeral-kanji"),
    percentUnits: patterns("percent-unit"),
    countWords: patterns("count-number"),
    figureNouns: patterns("figure-noun"),
  };
};

const KINDS: readonly NumberKind[] = ["count", "grouping", "percent", "count-small", "count-large"];

const findingOf = (mark: NumberMark, usual: NumberMark, count: number, of: number, limit: number): Finding => ({
  rule: "number-style-consistency",
  severity: "info",
  line: 0,
  column: 0,
  quote: mark.written,
  values: { written: mark.written, usual: usual.written, count, of, limit, offset: mark.offset },
  variant: mark.kind,
});

/** For each kind of number, the marks written in the document's less common style. */
export const numberStyleConsistency: Detector = (doc, options): Finding[] => {
  const words = wordsOf(doc);
  const marks = doc.sentences
    .filter((sentence) => sentence.embeddedLanguage === undefined && !isCitation(sentence, doc.source))
    .flatMap((sentence) => numberMarksIn(sentence, words, doc.language, doc.source));
  return KINDS.flatMap((kind) => {
    const ofKind = marks.filter((mark) => mark.kind === kind);
    const { odd, usual } = minorityStyles(ofKind, options.limit);
    return usual === undefined ? [] : odd.map((mark) => findingOf(mark, usual, odd.length, ofKind.length, options.limit));
  });
};
