import type { Amount } from "./total.ts";

/**
 * 丸めた単位（百万円、千円、億円、$3.1 million）で書いた金額の、最後の桁一つ分。丸めて書いた内訳と合計は、
 * 四捨五入でも切り捨てでも切り上げでも、内訳の数 − 1 桁までずれる（3,074百万円 + 2,434百万円 + 1,146百万円 と 総額6,655百万円）。
 */

/** 書いた数（6,655、3.1）。漢数字だけの金額は読まない。 */
const NUMERAL = /\d[\d,，]*(?:[.．]\d+)?/u;
/** 金額のすぐ後ろに書いた単位の語（$3.1 million の million）までのあいだ。 */
const UNIT_AFTER = /^[ \t]?([A-Za-z]+)/u;
const DECIMAL_BASE = 10;
/** 金額の後ろで単位の語を探す長さ。 */
const UNIT_REACH = 16;

/** 書いた数と、その小数の桁。 */
const numeralOf = (written: string): { readonly value: number; readonly decimals: number } | undefined => {
  const match = NUMERAL.exec(written.normalize("NFKC"));
  if (match === null) return undefined;
  const [whole = "", fraction = ""] = match[0].replace(/,/gu, "").split(".");
  return { value: Number(`${whole}.${fraction || "0"}`), decimals: fraction.length };
};

/** 金額が丸めた単位で書いてあるか。和文の単位は金額の中に（6,655百万円）、英語の単位は金額のすぐ後ろに（$5.6 million）ある。 */
const inRoundedUnit = (written: string, after: string, units: readonly string[]): boolean => {
  const word = UNIT_AFTER.exec(after)?.[1]?.toLowerCase();
  return units.some((unit) => written.includes(unit) || unit.toLowerCase() === word);
};

/** 丸めた単位で書いた金額の最後の桁一つ分を、金額の値の単位で。丸めた単位でなければ undefined。 */
export const displayStep = (source: string, amount: Amount, units: readonly string[]): number | undefined => {
  const written = source.slice(amount.offset, amount.end);
  if (!inRoundedUnit(written, source.slice(amount.end, amount.end + UNIT_REACH), units)) return undefined;
  const numeral = numeralOf(written);
  if (numeral === undefined || numeral.value === 0) return undefined;
  return (amount.value / numeral.value) * DECIMAL_BASE ** -numeral.decimals;
};

/** 金額のどれもが丸めた単位で書いてあれば、その一番粗い桁一つ分。一つでも丸めた単位でなければ 0（ずれを許さない）。 */
export const coarsestStep = (source: string, amounts: readonly Amount[], units: readonly string[]): number => {
  const steps = amounts.map((amount) => displayStep(source, amount, units));
  const known = steps.filter((step) => step !== undefined);
  return known.length === steps.length && known.length > 0 ? Math.max(...known) : 0;
};

/** 丸めた桁 step で書いた parts 個の内訳の和が、合計からずれてよい幅。 */
export const roundingAllowance = (step: number, parts: number): number => step * Math.max(0, parts - 1);
