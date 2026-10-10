import type { DurationUnit } from "../derived/date-arithmetic.ts";

/**
 * 期間を、比べられる単位に揃えた大きさ。年は月に直す（1年 と 12か月 は同じ長さ、2年 と 12か月 は違う長さ）。
 * 月と日、週と日は直さない: 1か月 は 28〜31日で、30日 と同じとは言えない。週と日はそのまま別の単位で、比べない。
 */
export type ScaledDuration = { readonly key: string; readonly unit: DurationUnit };

const MONTHS_PER_YEAR = 12;
/** 0.1年 × 12 の浮動小数の端（1.2000000000000002）を落とす桁。 */
const KEY_DIGITS = 1e6;

const scaledKey = (key: string, factor: number): string | undefined => {
  const amount = key.trim() === "" ? Number.NaN : Number(key);
  return Number.isFinite(amount) ? String(Math.round(amount * factor * KEY_DIGITS) / KEY_DIGITS) : undefined;
};

export const scaledDuration = (key: string, unit: DurationUnit): ScaledDuration => {
  if (unit !== "year") return { key, unit };
  const months = scaledKey(key, MONTHS_PER_YEAR);
  return months === undefined ? { key, unit } : { key: months, unit: "month" };
};
