import type { Tolerance } from "./measures.ts";

const HALF = 0.5;
const DECIMAL_BASE = 10;
const DECIMALS = /[.．]([0-9０-９]+)/u;
/** 端の値（1.2 kg と 1,250 g）が浮動小数の誤差で外れないための余り。 */
const FLOAT_SLACK = 1 + 1e-9;

/**
 * 小数で書いた量が言える幅の半分を、基準の単位で（1.2 kg は 1.15〜1.25 kg なので 0.05 kg）。書き手は小数点の後ろの最後の桁で丸めて
 * 書いている。整数（410 g、1 mile）は 0：末尾の 0 が丸めか（1,200 g）は書き方から分からず、仕様の整数はふつう書いたとおりの値なので、
 * 量の種類ごとの差（unit-tolerance）だけで比べる。
 */
export const writtenHalfStep = (written: string, factors: readonly number[]): number => {
  const decimals = DECIMALS.exec(written)?.[1]?.length;
  return decimals === undefined || factors.length === 0 ? 0 : HALF * DECIMAL_BASE ** -decimals * Math.max(...factors) * FLOAT_SLACK;
};

/** 二つの量を比べるときの、合うとみなす差。粗いほうの量の書いた桁の半分が、量の種類ごとの差より広ければそちら。 */
export const precisionTolerance = (tolerance: Tolerance, halfSteps: readonly number[]): Tolerance => ({
  relative: tolerance.relative,
  absolute: Math.max(tolerance.absolute, ...halfSteps),
});
