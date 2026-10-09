import type { Span } from "../plugin.ts";
import type { StructureIssue } from "./issues.ts";
import { escapeRegExp } from "../orthography.ts";

/**
 * 書いた定員より多い申込・招待・参加の人数（定員：90名 と 95名の方にお申し込み、Capacity: 90 seats と 95 members have registered）。
 * 定員の語（定員、先着、capacity、limited to）と人数の語（申込、招待者、have registered）を付けた数だけを読み、語の無い数は読まない。
 * 比べるのは、文書に定員が一つ（一つの値）だけ書いてあるときだけ。二つ以上あれば、どの人数がどの定員のものか決められない。
 * 数える物の組が違う数（30組と45名）は比べない。キャンセル待ちや抽選の語が文書にあれば、定員を超える申込は書いたとおりのことなので
 * 言わない。一回あたりの数（各回定員20名、20 per session）は、定員でも人数でも比べない。全体の人数と一回の定員は比べられない。
 * 去年や前回の人数（昨年は120名が参加）は、この催しの人数ではないので読まない。語は言語パッケージの語彙表から受け取る。
 */

/** 語彙表の一語。position は数のどちら側に書くか。group は語の種類（数える物の組、place の付いた定員の語）。 */
export type CountMark = { readonly pattern: string; readonly position?: "before" | "after" | undefined; readonly group?: string | undefined };

export type CapacityWords = {
  /** 定員の語。group が place のものは、席の数（seats、places）にだけ付く（there are 25 places）。 */
  readonly capacities: readonly CountMark[];
  /** 申込・招待・参加の人数の語。 */
  readonly counts: readonly CountMark[];
  /** 数える物の語（名、人、席、people、seats）。group は組（head は人、place は席で人と比べる、party は組や家族）。 */
  readonly units: readonly CountMark[];
  /** 文書にあれば定員を超える申込を言わない語（キャンセル待ち、抽選、waitlist）。 */
  readonly overflows: readonly string[];
  /** 同じ行にあれば一回・一日あたりの数だと言う語（各回、per session）。 */
  readonly perSession: readonly string[];
  /** 人数と同じ行にあれば別の時の人数だと言う語（昨年、前回、last year）。 */
  readonly otherOccasions: readonly string[];
  /** 人数の後ろの句にあれば、申し込んでいない人の数だと言う語（していません、not）。 */
  readonly negations: readonly string[];
};

/** 句の切れ目。人数の後ろの打ち消しは、ここまでで探す。 */
const CLAUSE_BREAK = /[。．.!?！？;；、,，\n]/u;

const clauseAfter = (source: string, end: number): string => {
  const rest = source.slice(end);
  const cut = CLAUSE_BREAK.exec(rest)?.index ?? rest.length;
  return rest.slice(0, cut);
};

/** 語の付いた数。unit は数える物の組で、単位を書かない数（capacity 30）は undefined。line はその数の行。 */
export type LabelledCount = {
  readonly start: number;
  readonly end: number;
  readonly value: number;
  readonly unit: string | undefined;
  readonly line: string;
};

const DIGIT = "[0-9０-９]";
/** 整数（1,200 は千二百）。小数と、桁区切りの続きの途中からは読まない。 */
const NUMBER = new RegExp(`(?<!${DIGIT}|[.,，．])${DIGIT}+(?:[,，]${DIGIT}{3})*(?!${DIGIT}|[.,，．]${DIGIT})`, "gu");

/** 記号と空白を除いて、語と数の間に挟んでよいもの（定員：90名、定員は25名、capacity of 30、registrations: 45）。 */
const BEFORE_GAP_WORDS: ReadonlySet<string> = new Set(["", "は", "が", "of", "is", "was", "at"]);
const isBeforeGap = (gap: string): boolean => BEFORE_GAP_WORDS.has(lower(gap.replaceAll(/[\s:：=]/gu, "")));
/** 数（と単位）と後ろの和語の間に挟んでよいもの（95名の方にお申し込み、28名のお申し込み）。 */
const AFTER_GAP_CJK = /^(?:の方|の皆様|の皆さま)?(?:[にがの]|から)?[おご]?$/u;
/** 数（と単位）と後ろの英語の間の語は三つまで（95 members have registered、28 children had already booked）。 */
const AFTER_GAP_LATIN = /^(?:\s+[A-Za-z]+){0,3}\s+$/u;
/** 英語の単位は数との間に空白を一つ置ける（90 seats）。 */
const LATIN_UNIT_GAP = /^\s?/u;
const WORD_NEXT = /^\s?[A-Za-z]/u;

const LETTER = /[A-Za-z]/u;

const lower = (text: string): string => text.toLowerCase();

const isLatin = (word: string): boolean => LETTER.test(word.charAt(0));

const numberOf = (digits: string): number => Number(digits.normalize("NFKC").replaceAll(/[,，]/gu, ""));

const startsWithWord = (text: string, word: string): boolean =>
  lower(text).startsWith(lower(word)) && !(LETTER.test(word.slice(-1)) && LETTER.test(text.charAt(word.length)));

const endsWithWord = (text: string, word: string): boolean =>
  lower(text).endsWith(lower(word)) && !(LETTER.test(word.charAt(0)) && LETTER.test(text.charAt(text.length - word.length - 1)));

/** 英字の語は語の切れ目で照らす（past が pastry に当たらない）。 */
const contains = (text: string, words: readonly string[]): boolean =>
  words.some((word) =>
    [...lower(text).matchAll(new RegExp(escapeRegExp(lower(word)), "gu"))].some(
      (match) => startsWithWord(text.slice(match.index), word) && endsWithWord(text.slice(0, match.index + word.length), word),
    ),
  );

type Unit = { readonly mark: CountMark; readonly end: number };

/** 数のすぐ後ろの単位と、単位の終わりの位置。長い語から照らす。 */
const unitAfter = (line: string, end: number, units: readonly CountMark[]): Unit | undefined =>
  units
    .toSorted((left, right) => right.pattern.length - left.pattern.length)
    .flatMap((mark) => {
      const gap = isLatin(mark.pattern) ? (LATIN_UNIT_GAP.exec(line.slice(end))?.[0].length ?? 0) : 0;
      return startsWithWord(line.slice(end + gap), mark.pattern) ? [{ mark, end: end + gap + mark.pattern.length }] : [];
    })[0];

const labelBefore = (head: string, marks: readonly CountMark[]): CountMark | undefined =>
  marks
    .filter((mark) => mark.position !== "after")
    .find((mark) => {
      const at = lower(head).lastIndexOf(lower(mark.pattern));
      const end = at + mark.pattern.length;
      return at !== -1 && endsWithWord(head.slice(0, end), mark.pattern) && isBeforeGap(head.slice(end));
    });

const labelAfter = (tail: string, marks: readonly CountMark[]): CountMark | undefined =>
  marks
    .filter((mark) => mark.position === "after")
    .find((mark) => {
      const at = lower(tail).indexOf(lower(mark.pattern));
      if (at === -1 || !startsWithWord(tail.slice(at), mark.pattern)) return false;
      return (isLatin(mark.pattern) ? AFTER_GAP_LATIN : AFTER_GAP_CJK).test(tail.slice(0, at));
    });

/**
 * 語の付いた数か。和語の語には単位が要る（定員90 は読まない）。英語の数は単位を書かなくてよいが、後ろに単位でない語が続けば
 * 別の物の数（capacity 30 cars）。place の付いた語は席の数にだけ付く。
 */
const isLabelled = (label: CountMark | undefined, unit: Unit | undefined, after: string, afterLabel: CountMark | undefined): label is CountMark => {
  if (label === undefined || (label.group === "place" && unit?.mark.group !== "place")) return false;
  if (unit !== undefined) return true;
  return isLatin(label.pattern) && (afterLabel !== undefined || !WORD_NEXT.test(after));
};

/** 一行の中の、語の付いた数。 */
const labelledIn = (line: string, lineStart: number, marks: readonly CountMark[], units: readonly CountMark[]): LabelledCount[] =>
  [...line.matchAll(NUMBER)].flatMap((match) => {
    const unit = unitAfter(line, match.index + match[0].length, units);
    const end = unit?.end ?? match.index + match[0].length;
    const after = line.slice(end);
    const afterLabel = labelAfter(after, marks);
    if (!isLabelled(labelBefore(line.slice(0, match.index), marks) ?? afterLabel, unit, after, afterLabel)) return [];
    return [{ start: lineStart + match.index, end: lineStart + end, value: numberOf(match[0]), unit: unit?.mark.group, line }];
  });

const linesOf = (source: string): { readonly text: string; readonly start: number }[] => {
  const starts = [0, ...[...source.matchAll(/\n/gu)].map((match) => match.index + 1)];
  return starts.map((start, index) => ({ text: source.slice(start, (starts[index + 1] ?? source.length + 1) - 1), start }));
};

const readAll = (source: string, marks: readonly CountMark[], units: readonly CountMark[]): LabelledCount[] =>
  linesOf(source).flatMap((line) => labelledIn(line.text, line.start, marks, units));

/** 席（place）は人（head）と同じ組として比べる。単位を書かない数は人の数。 */
export const comparableGroup = (unit: string | undefined): string => (unit === undefined || unit === "place" ? "head" : unit);

/** 文書の中の、定員の語の付いた数。一回あたりの定員は除く。 */
export const capacityStatements = (source: string, words: CapacityWords): LabelledCount[] =>
  readAll(source, words.capacities, words.units).filter((reading) => !contains(reading.line, words.perSession));

/** 文書の中の、人数の語の付いた数。一回あたりの人数と、別の時の人数は除く。 */
export const countStatements = (source: string, words: CapacityWords): LabelledCount[] =>
  readAll(source, words.counts, words.units).filter(
    (reading) =>
      !contains(reading.line, words.perSession) &&
      !contains(reading.line, words.otherOccasions) &&
      !contains(clauseAfter(source, reading.end), words.negations),
  );

/** 定員を超える人数のうち一番多いもの。定員が一つの値でなければ、比べない。 */
export const overCapacity = (
  capacities: readonly LabelledCount[],
  counts: readonly LabelledCount[],
): { readonly capacity: LabelledCount; readonly over: LabelledCount } | undefined => {
  const capacity = capacities[0];
  if (capacity === undefined || capacities.some((other) => other.value !== capacity.value)) return undefined;
  const over = counts
    .filter((count) => comparableGroup(count.unit) === comparableGroup(capacity.unit) && count.value > capacity.value)
    .toSorted((left, right) => right.value - left.value)[0];
  return over === undefined ? undefined : { capacity, over };
};

/** その位置を含む一番小さい節の原文。節が無ければ文書の全体。 */
export const sectionAround = (source: string, offset: number, sections: readonly Span[]): string => {
  const around = sections
    .filter((section) => section.start <= offset && offset < section.end)
    .toSorted((left, right) => left.end - left.start - (right.end - right.start))[0];
  return around === undefined ? source : source.slice(around.start, around.end);
};

/**
 * 定員より多い人数。キャンセル待ちや抽選の語のある節の定員と人数は読まない（定員を超える申込が書いたとおりのこと）。
 * 節に限るのは、別の節の「抽選会」（催しの一つ）で比べるのをやめないため。定員の位置を指す。sections は節の範囲。
 */
export const countsOverCapacity = (source: string, words: CapacityWords, sections: readonly Span[] = []): StructureIssue[] => {
  const settled = (reading: LabelledCount): boolean => !contains(sectionAround(source, reading.start, sections), words.overflows);
  const capacities = capacityStatements(source, words);
  if (!capacities.every(settled)) return [];
  const found = overCapacity(capacities, countStatements(source, words).filter(settled));
  if (found === undefined) return [];
  const { capacity, over } = found;
  return [{ offset: capacity.start, values: { capacity: source.slice(capacity.start, capacity.end), count: source.slice(over.start, over.end) } }];
};
