import type { FactValue } from "./fact-values.ts";
import { lineHasContext, standsAsUnitWord } from "./unit-word.ts";

/**
 * 単位の付いた量（5 km、3000 m、1.5時間、2 GB、180℃、大さじ1）。単位は言語パッケージの語彙表から取り、量の種類（長さ、重さ…）と、基準の単位への
 * 倍率を持つ。倍率が二つある単位（1 GB は 10^9 か 2^30 バイト）は、どちらで数えても合えば合う。零点がずれた単位（°F）は zero を引いてから掛ける。
 */
export type MeasureUnit = {
  readonly pattern: string;
  readonly dimension: string;
  readonly factors: readonly number[];
  /** 基準の単位で 0 のときに、この単位で読む値（°F なら 32）。 */
  readonly zero: number;
  /** 数の前に書く単位（大さじ1）。 */
  readonly before: boolean;
  /** 同じ行にどれかが無ければ単位として読まない語（「度」はオーブンの行だけ温度）。空なら要らない。 */
  readonly context: readonly string[];
};

export type Measured = FactValue & {
  readonly dimension: string;
  readonly factors: readonly number[];
  readonly zero: number;
  readonly amount: number;
  /** 書いた小数の桁数（1.20 なら 2）。amount は数なので末尾の 0 を持たない。 */
  readonly decimals: number;
};

/** 換算して合うとみなす差。relative は大きいほうの値に対する割合、absolute は基準の単位での差。どちらかに収まれば合う。 */
export type Tolerance = { readonly relative: number; readonly absolute: number };

/**
 * 前に英字や数が続く数（v2、A4、1.2.3 の 2）と、分数の分母（1/2 の 2）は量ではない。日本語は数の前に空白を置かないので、仮名や漢字の後ろはよい。
 * 字や数のすぐ後ろでない負の符号は数に含める（-20 °C）。20-25°C の - は範囲の印。
 */
const NUMBER = /(?<![\p{Script=Latin}\p{N}.,])(?<![0-9０-９][/／])[0-9０-９]+(?:[,，][0-9０-９]{3})*(?:[.．][0-9０-９]+)?/gu;
const MINUS_SIGNS = new Set(["-", "−", "－"]);
const BEFORE_SIGN = /[\p{L}\p{N}.,]/u;

/** 数の頭の負の符号の位置。符号が無ければ数の頭。 */
const signedStart = (source: string, start: number): number =>
  MINUS_SIGNS.has(source.charAt(start - 1)) && !BEFORE_SIGN.test(source.charAt(start - 2)) ? start - 1 : start;

/** 数のすぐ後ろに分数が続く（大さじ1と1/2、1 1/2 cups、1½）。数だけを読むと量を取り違える。 */
const FRACTION_AFTER = /^.?[0-9０-９]*[/／][0-9０-９]|^.?[½⅓⅔¼¾⅛]/u;

const MAX_UNIT_LENGTH = 20;

const lineAt = (source: string, offset: number): string => {
  const end = source.indexOf("\n", offset);
  return source.slice(source.lastIndexOf("\n", offset - 1) + 1, end === -1 ? source.length : end);
};

const inContext = (unit: MeasureUnit, source: string, offset: number): boolean =>
  unit.context.length === 0 || lineHasContext(lineAt(source, offset), unit.context);

/** 数と単位のあいだに置ける字。空白一つか、英語の複合語のハイフン（13.3-inch display）。 */
const GAPS = new Set([" ", "-"]);

type Found = { readonly unit: MeasureUnit; readonly start: number; readonly end: number };

/**
 * 数のすぐ後ろ（空白かハイフン一つまで）の単位。長い単位から試す（「5分間」を 分 で切らない、min を m にしない）。
 * 単位の後ろに語が続く（5 miners）ものは、名前付きの値の終わり（fact-value-end）で落ちるので、ここでは見ない。
 */
const unitAfter = (source: string, start: number, end: number, units: readonly MeasureUnit[]): Found | undefined => {
  const gap = GAPS.has(source.charAt(end)) ? 1 : 0;
  const rest = source.slice(end + gap, end + gap + MAX_UNIT_LENGTH);
  const unit = units.find(
    (candidate) =>
      !candidate.before &&
      rest.startsWith(candidate.pattern) &&
      standsAsUnitWord(candidate.pattern, candidate.context.length > 0, source.slice(end + gap + candidate.pattern.length)) &&
      inContext(candidate, source, end),
  );
  return unit === undefined ? undefined : { unit, start, end: end + gap + unit.pattern.length };
};

/** 数のすぐ前（空白一つまで）の単位（大さじ1）。 */
const unitBefore = (source: string, start: number, end: number, units: readonly MeasureUnit[]): Found | undefined => {
  const gap = source.charAt(start - 1) === " " ? 1 : 0;
  const head = source.slice(Math.max(0, start - gap - MAX_UNIT_LENGTH), start - gap);
  const unit = units.find((candidate) => candidate.before && head.endsWith(candidate.pattern) && inContext(candidate, source, start));
  return unit === undefined ? undefined : { unit, start: start - gap - unit.pattern.length, end };
};

/** 文書の中の、単位の付いた量。 */
export const measuredValues = (source: string, units: readonly MeasureUnit[]): Measured[] => {
  const longestFirst = units.toSorted((left, right) => right.pattern.length - left.pattern.length);
  return [...source.matchAll(NUMBER)].flatMap((match): Measured[] => {
    const end = match.index + match[0].length;
    if (FRACTION_AFTER.test(source.slice(end, end + MAX_UNIT_LENGTH))) return [];
    const start = signedStart(source, match.index);
    const found = unitAfter(source, start, end, longestFirst) ?? unitBefore(source, start, end, longestFirst);
    if (found === undefined) return [];
    const written = match[0].normalize("NFKC").replace(/,/gu, "");
    const magnitude = Number(written);
    const amount = start < match.index ? -magnitude : magnitude;
    const { unit } = found;
    return [
      {
        start: found.start,
        end: found.end,
        kind: "quantity",
        key: String(amount),
        unit: unit.pattern,
        dimension: unit.dimension,
        factors: unit.factors,
        zero: unit.zero,
        amount,
        decimals: written.split(".")[1]?.length ?? 0,
      },
    ];
  });
};

/** 二つの量の単位が、書き方だけ違う同じ単位か（mL と ml、tablespoon と tablespoons）。 */
export const sameUnit = (left: Measured, right: Measured): boolean =>
  left.zero === right.zero && left.factors.length === right.factors.length && left.factors.every((factor, index) => factor === right.factors[index]);

const agrees = (x: number, y: number, tolerance: Tolerance): boolean => {
  const difference = Math.abs(x - y);
  return difference <= tolerance.absolute || difference <= Math.max(Math.abs(x), Math.abs(y)) * tolerance.relative;
};

/** 零点のずれた単位で、零点より小さい量（1 °F）。温度の読みより、差（0.5 ℃ の上昇は 0.9 °F）のことが多い。 */
const couldBeDifference = (value: Measured): boolean => value.zero !== 0 && Math.abs(value.amount) < Math.abs(value.zero);

/**
 * 二つの量が同じ量か。倍率のどの組み合わせかで、基準の単位に直した値の差が tolerance に収まれば同じ。零点より小さい °F の量は、差として
 * 零点を引かずに直しても合えば合う（0.5°C (1°F)）。180 °F は差としては読まないので、100 °C (180 °F) は合わない。
 */
export const sameMeasure = (left: Measured, right: Measured, tolerance: Tolerance): boolean => {
  const difference = couldBeDifference(left) || couldBeDifference(right);
  return left.factors.some((a) =>
    right.factors.some(
      (b) =>
        agrees((left.amount - left.zero) * a, (right.amount - right.zero) * b, tolerance) ||
        (difference && agrees(left.amount * a, right.amount * b, tolerance)),
    ),
  );
};
