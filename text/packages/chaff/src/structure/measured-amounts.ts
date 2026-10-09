import type { Amount } from "./total.ts";
import { CONTINUES_WORD, NUMBER, overlapsAny, valueOf } from "./counted-amounts.ts";

/**
 * 足してよい、単位の付いた量（300 mg、0.5 g、2 L、3 cm）。単位は量の種類（dimension）と、基準の単位への倍率（factors）を持つ。
 * 同じ種類の量は、その種類で一番小さい単位に直して足す（500 mg と 0.5 g は 1,000 mg）。倍率が二つある単位（cup）は換算が決まらない。
 */
export type SummedMeasure = { readonly pattern: string; readonly dimension: string; readonly factors: readonly number[] };

/** 足せない量の印。目安の印（約、about、程度）、範囲の印（〜）、何あたりかの印（数の前の $3 / 200 g、単位の後ろの 300 mg/錠、per tablet）。 */
export type MeasureMarks = {
  readonly roughBefore: readonly string[];
  readonly roughAfter: readonly string[];
  readonly connectors: readonly string[];
  readonly perMarks: readonly string[];
};

/**
 * 足せない量の単位に付ける印。量は読むが、単位に位置も入れて、ほかのどの量とも同じ単位にならないようにする。その量がある列の和は取らない。
 * 読まずに捨てると、その行が空の升に見えて、残りの行の和を合計と比べてしまう。
 */
const UNSUMMABLE = "?";

const LOOKAHEAD = 32;
const LATIN = /\p{Script=Latin}/u;
const DIGIT_AT_END = /\p{N}$/u;

const lineStartOf = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

/** text が word で終わり、英字の語なら語の途中（awesome の some）でない。 */
const endsWithWord = (text: string, word: string): boolean => {
  if (!text.toLowerCase().endsWith(word.toLowerCase())) return false;
  return !LATIN.test(word.charAt(0)) || !LATIN.test(text.charAt(text.length - word.length - 1));
};

/** text が word で始まり、英字の語なら語の途中（personal の per）でない。 */
const startsWithWord = (text: string, word: string): boolean => {
  if (!text.toLowerCase().startsWith(word.toLowerCase())) return false;
  return !LATIN.test(word.at(-1) ?? "") || !LATIN.test(text.charAt(word.length));
};

/**
 * 数の前の目安の印（約300mg、about 300 mg）、何あたりかの印（$3 / 200 g、$3 per 200 g）、
 * 範囲の後ろの端（300〜400mg、300 - 400 mg）。
 */
const markedBefore = (source: string, start: number, marks: MeasureMarks): boolean => {
  const before = source.slice(lineStartOf(source, start), start);
  const trimmed = before.trimEnd();
  if ([...marks.roughBefore, ...marks.perMarks].some((word) => endsWithWord(trimmed, word))) return true;
  return marks.connectors.some(
    (connector) => before.endsWith(connector) || (trimmed.endsWith(connector) && DIGIT_AT_END.test(trimmed.slice(0, -connector.length).trimEnd())),
  );
};

/** 印の前に置かれうる、開き括弧と空白（5 mg (per tablet)）。 */
const OPENING = /^[\s(（[［]+/u;

/** 単位の後ろの、目安の印（300mg程度）か何あたりかの印（300 mg/tablet、300 mg per tablet、5 mg (per tablet)）。 */
const markedAfter = (source: string, end: number, marks: MeasureMarks): boolean => {
  const after = source.slice(end, end + LOOKAHEAD).replace(OPENING, "");
  return [...marks.roughAfter, ...marks.perMarks].some((word) => startsWithWord(after, word));
};

type Found = { readonly measure: SummedMeasure; readonly end: number };

/** 数のすぐ後ろ（空白一つまで）の単位。長い単位から試す（mg を m で切らない）。大文字と小文字は区別する（mL と ML は別）。 */
const measureAfter = (source: string, end: number, measures: readonly SummedMeasure[], marks: MeasureMarks): Found | undefined => {
  const gap = source.charAt(end) === " " ? 1 : 0;
  const rest = source.slice(end + gap, end + gap + LOOKAHEAD);
  const measure = measures.find((candidate) => {
    if (!rest.startsWith(candidate.pattern)) return false;
    const unitEnd = end + gap + candidate.pattern.length;
    return markedAfter(source, unitEnd, marks) || !CONTINUES_WORD.test(rest.slice(candidate.pattern.length));
  });
  return measure === undefined ? undefined : { measure, end: end + gap + measure.pattern.length };
};

/** 量の種類ごとの、一番小さい倍率。倍率が一つの単位だけから取る。 */
const baseFactors = (measures: readonly SummedMeasure[]): Map<string, number> =>
  measures.reduce((bases, measure) => {
    const [factor] = measure.factors;
    if (measure.factors.length !== 1 || factor === undefined || factor <= 0) return bases;
    return bases.set(measure.dimension, Math.min(bases.get(measure.dimension) ?? factor, factor));
  }, new Map<string, number>());

const unsummable = (offset: number, end: number, value: number, measure: SummedMeasure): Amount => ({
  offset,
  end,
  value,
  unit: `${measure.dimension}${UNSUMMABLE}${String(offset)}`,
});

const amountOf = (source: string, start: number, written: string, found: Found, bases: Map<string, number>, marks: MeasureMarks): Amount => {
  const value = valueOf(written);
  const { measure } = found;
  const [factor] = measure.factors;
  const base = bases.get(measure.dimension);
  const sure = measure.factors.length === 1 && factor !== undefined && base !== undefined;
  if (!sure || markedBefore(source, start, marks) || markedAfter(source, found.end, marks)) return unsummable(start, found.end, value, measure);
  const scale = factor / base;
  return { offset: start, end: found.end, value: value * scale, unit: measure.dimension, scale };
};

/** 文書の中の、単位の付いた量。値は量の種類で一番小さい単位に直す。木がすでに数量として読んだもの（known）とは重ねない。 */
export const measuredAmounts = (source: string, measures: readonly SummedMeasure[], marks: MeasureMarks, known: readonly Amount[]): Amount[] => {
  const longestFirst = measures.toSorted((left, right) => right.pattern.length - left.pattern.length);
  const bases = baseFactors(measures);
  return [...source.matchAll(NUMBER)].flatMap((match): Amount[] => {
    const found = measureAfter(source, match.index + match[0].length, longestFirst, marks);
    if (found === undefined || overlapsAny(match.index, found.end, known)) return [];
    return [amountOf(source, match.index, match[0], found, bases, marks)];
  });
};
