import type { Measured, Tolerance } from "./measures.ts";

const HALF = 0.5;
const DECIMAL_BASE = 10;

const decimalsOf = (amount: number): number => {
  const [, fraction = ""] = String(Math.abs(amount)).split(".");
  return fraction.length;
};

/** 目安の量（約1.2kg）が言える幅を、基準の単位で。書いた最後の桁の半分（約1.2kg は 1.15〜1.25 kg）。 */
const writtenHalfStep = (value: Measured): number => {
  const step = HALF * DECIMAL_BASE ** -decimalsOf(value.amount);
  return step * Math.max(...value.factors);
};

/**
 * 目安と書いた量を含む二つを比べるときの、合うとみなす差。目安の量は書いた桁までしか言っていないので、その桁の半分までの差は合う。
 * 量の種類ごとの差（tolerance）のほうが広ければ、そちら。
 */
export const approximateTolerance = (tolerance: Tolerance, approximate: readonly Measured[]): Tolerance => ({
  relative: tolerance.relative,
  absolute: Math.max(tolerance.absolute, ...approximate.map(writtenHalfStep)),
});
