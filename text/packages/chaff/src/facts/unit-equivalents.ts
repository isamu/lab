import { sameMeasure, sameUnit, type Measured, type Tolerance } from "./measures.ts";
import { toleranceOf } from "./unit-tolerance.ts";

/**
 * 一つの量を二つの単位で並べて書いた所（180℃（350°F）、300 kPa (about 44 psi)）。括弧の中の量は、外の量を換算して丸めたもの。
 * 括弧は量のすぐ後ろ（空白一つまで）で、中は前置き（約、about）を一つまで挟んですぐ量。量の後ろに字や数が続く括弧は、換算ではない。
 * どちらが元の量かは分からないので、二つの数をそれぞれの桁で丸めたものとして比べる。
 */
export type UnitPair = { readonly measured: Measured; readonly other: Measured };

const OPENERS = ["（", "("];
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const LATIN_LETTER = /\p{Script=Latin}/u;
const DECIMALS = /[.．]([0-9０-９]+)/u;
const DIGITS = /[0-9０-９]+/u;
const HALF = 0.5;
const DECIMAL_BASE = 10;

const skipSpace = (source: string, offset: number): number => (source.charAt(offset) === " " ? offset + 1 : offset);

/** 前置きの後ろ。英字で終わる前置き（about）は、後ろに英字が続けば前置きではない（aboutness）。 */
const afterHedge = (source: string, offset: number, hedges: readonly string[]): number => {
  const rest = source.slice(offset).toLowerCase();
  const hedge = hedges.find(
    (word) => rest.startsWith(word.toLowerCase()) && !(LATIN_LETTER.test(word.slice(-1)) && LATIN_LETTER.test(rest.charAt(word.length))),
  );
  return hedge === undefined ? offset : skipSpace(source, offset + hedge.length);
};

/** 量の後ろの括弧の中で、換算した量が始まる所。括弧が無ければ undefined。 */
const insideBracket = (source: string, end: number, hedges: readonly string[]): number | undefined => {
  const open = skipSpace(source, end);
  return OPENERS.includes(source.charAt(open)) ? afterHedge(source, open + 1, hedges) : undefined;
};

/**
 * 書いた数を丸めた桁の半分を、基準の単位で（44 psi なら 0.5 psi、1.6 km なら 0.05 km）。0 で終わる整数は、最後の 0 の一つ上の桁で
 * 丸めたとみなす（100 miles は 10 の位で ±5）。0 一つ（60、180）は 1 の位のまま。
 */
const trailingZeros = (digits: string): number => {
  const reversed = [...digits.normalize("NFKC")].reverse();
  const nonZero = reversed.findIndex((digit) => digit !== "0");
  return nonZero === -1 ? reversed.length : nonZero;
};

const halfRoundingStep = (source: string, measured: Measured): number => {
  const written = source.slice(measured.start, measured.end).replace(/,/gu, "");
  const decimals = DECIMALS.exec(written)?.[1]?.length;
  const zeros = trailingZeros(DIGITS.exec(written)?.[0] ?? "");
  const exponent = decimals === undefined ? Math.max(0, zeros - 1) : -decimals;
  return HALF * DECIMAL_BASE ** exponent * Math.min(...measured.factors);
};

/** 二つの数が、同じ値をそれぞれの桁で丸めたものでありうるなら合う。温度は、オーブンの目盛りの差（unit-tolerance）までも合う。 */
const pairTolerance = (source: string, first: Measured, second: Measured): Tolerance => {
  const tolerance = toleranceOf(second.dimension);
  return { relative: tolerance.relative, absolute: Math.max(tolerance.absolute, halfRoundingStep(source, first) + halfRoundingStep(source, second)) };
};

/** 二つの単位で並べた量のうち、換算すると合わないもの。 */
export const unitPairs = (source: string, measured: readonly Measured[], hedges: readonly string[]): UnitPair[] => {
  const byStart = new Map(measured.map((value) => [value.start, value]));
  return measured.flatMap((other): UnitPair[] => {
    const start = insideBracket(source, other.end, hedges);
    const value = start === undefined ? undefined : byStart.get(start);
    if (value === undefined || value.dimension !== other.dimension || sameUnit(value, other)) return [];
    if (LETTER_OR_DIGIT.test(source.charAt(value.end))) return [];
    return sameMeasure(other, value, pairTolerance(source, other, value)) ? [] : [{ measured: value, other }];
  });
};
