import type { Span } from "../plugin.ts";
import { bySentence } from "./sentence-buckets.ts";

/**
 * 起点の年から数えた年数（「2015年創業」と「創業10年」、「1980年生まれ」と「45歳」）を、文書の日付の年と比べる。
 * 年数は、文書の年から起点の年を引いた数と、前後一年まで合えばよい（誕生日の前後、「10年目」の数え方）。それより離れていれば言う。
 * 創業の年数は、起点の語のすぐ後ろか前に、つなぎの語（から、以来、since）だけを挟んで書いたもの（「創業10年」「設立から10年」）。
 * 起点の年は同じ文の中で起点の語に一番近い年、無ければ文書の中で起点の語に付いた年（一通りのときだけ）。
 * 年齢は、生まれた年と同じ文の年齢だけを比べる（文に生まれた年と年齢が一つずつのとき）。別の人の年齢と組にしないため。
 */
export type Year = Span & { readonly year: number };

export type Elapsed = Span & { readonly amount: number };

export type OriginWord = Span & { readonly pattern: string };

export type ElapsedInput = {
  readonly source: string;
  readonly sentences: readonly Span[];
  readonly years: readonly Year[];
  /** 創業・設立・founded など、年数を数え始める語。 */
  readonly foundings: readonly OriginWord[];
  /** 生まれ・born など。 */
  readonly births: readonly OriginWord[];
  /** 年数（10年、20周年、10 years）。 */
  readonly elapsed: readonly Elapsed[];
  /** 年齢（45歳、aged 45）。 */
  readonly ages: readonly Elapsed[];
  /** 起点の語と年数のあいだに書いてよい語（から、以来、since）。何も挟まないのもよい。 */
  readonly links: readonly string[];
  /** 文書の日付の年。 */
  readonly reference: number;
};

export type ElapsedMismatch = { readonly elapsed: Elapsed; readonly origin: Year; readonly expected: number };

const TOLERANCE = 1;

const distance = (left: Span, right: Span): number => Math.max(0, left.start - right.end, right.start - left.end);

const nearest = <T extends Span>(spans: readonly T[], to: Span): T | undefined =>
  spans.reduce<T | undefined>((best, span) => (best === undefined || distance(span, to) < distance(best, to) ? span : best), undefined);

/** 起点の語と年数のあいだが、空か、つなぎの語だけ。 */
const attached = (input: ElapsedInput, word: Span, amount: Span): boolean => {
  const between = (word.end <= amount.start ? input.source.slice(word.end, amount.start) : input.source.slice(amount.end, word.start)).trim().toLowerCase();
  return between === "" || input.links.some((link) => link.toLowerCase() === between);
};

const mismatchOf = (input: ElapsedInput, elapsed: Elapsed, origin: Year): ElapsedMismatch[] => {
  const expected = input.reference - origin.year;
  return expected >= 0 && Math.abs(elapsed.amount - expected) > TOLERANCE ? [{ elapsed, origin, expected }] : [];
};

/** 起点の年は、起点の語のすぐ近く（「2015年に創業」「founded in 2015」）に書いたものだけ。同じ文の遠い数（Model 2015）は年と読まない。 */
const MAX_YEAR_DISTANCE = 6;

/** 一つの文の中の、読んだものすべて。 */
type InSentence = {
  readonly years: readonly Year[];
  readonly foundings: readonly OriginWord[];
  readonly births: readonly OriginWord[];
  readonly elapsed: readonly Elapsed[];
  readonly ages: readonly Elapsed[];
};

const yearAt = (years: readonly Year[], word: Span): Year | undefined => {
  const year = nearest(years, word);
  return year !== undefined && distance(year, word) <= MAX_YEAR_DISTANCE ? year : undefined;
};

/** 文書の中で、起点の語（創業、設立、founded）に付いた年。一通りに決まらなければ undefined。 */
const documentYear = (sentences: readonly InSentence[]): Year | undefined => {
  const found = sentences.flatMap((sentence) =>
    sentence.foundings.flatMap((word) => {
      const year = yearAt(sentence.years, word);
      return year === undefined ? [] : [year];
    }),
  );
  return new Set(found.map((year) => year.year)).size === 1 ? found[0] : undefined;
};

const foundingMismatches = (input: ElapsedInput, sentence: InSentence, fallback: Year | undefined): ElapsedMismatch[] =>
  sentence.elapsed.flatMap((elapsed) => {
    const word = sentence.foundings.find((candidate) => attached(input, candidate, elapsed));
    if (word === undefined) return [];
    const origin = yearAt(sentence.years, word) ?? fallback;
    return origin === undefined ? [] : mismatchOf(input, elapsed, origin);
  });

const ageMismatches = (input: ElapsedInput, sentence: InSentence): ElapsedMismatch[] => {
  const [word] = sentence.births;
  const [age] = sentence.ages;
  if (sentence.births.length !== 1 || sentence.ages.length !== 1 || word === undefined || age === undefined) return [];
  const origin = sentence.years.length === 1 ? sentence.years[0] : undefined;
  return origin === undefined ? [] : mismatchOf(input, age, origin);
};

/** 文書の年より前の年だけを起点にする。文書の日付そのもの（「2026年4月1日現在、創業10年」）は起点ではない。 */
const sentencesOf = (input: ElapsedInput): InSentence[] => {
  const groups = {
    years: bySentence(
      input.sentences,
      input.years.filter((year) => year.year < input.reference),
    ),
    foundings: bySentence(input.sentences, input.foundings),
    births: bySentence(input.sentences, input.births),
    elapsed: bySentence(input.sentences, input.elapsed),
    ages: bySentence(input.sentences, input.ages),
  };
  const indexes = [...new Set([...groups.foundings.keys(), ...groups.births.keys()])].toSorted((left, right) => left - right);
  return indexes.map((index) => ({
    years: groups.years.get(index) ?? [],
    foundings: groups.foundings.get(index) ?? [],
    births: groups.births.get(index) ?? [],
    elapsed: groups.elapsed.get(index) ?? [],
    ages: groups.ages.get(index) ?? [],
  }));
};

export const elapsedMismatches = (input: ElapsedInput): ElapsedMismatch[] => {
  const sentences = sentencesOf(input);
  const fallback = documentYear(sentences);
  return sentences.flatMap((sentence) => [...foundingMismatches(input, sentence, fallback), ...ageMismatches(input, sentence)]);
};
