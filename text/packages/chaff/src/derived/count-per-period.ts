import type { Span } from "../plugin.ts";
import { overlapsAny, type SpanIndex } from "../compare/spans.ts";
import type { DurationUnit } from "./date-arithmetic.ts";

/** A word that names a period (週, 毎月, a week), where it is written beside the count, and the period's unit. */
export type PeriodWord = { readonly word: string; readonly position: "before" | "after"; readonly unit: DurationUnit };

/** The period words, and the named schedules in the document (週休2日制, 4週8休). */
export type PerPeriodWords = { readonly periods: readonly PeriodWord[]; readonly schedules: SpanIndex };

const UNIT_ORDER: readonly DurationUnit[] = ["day", "week", "month", "year"];

/** A number or a counter just before the period word: 1年3か月 and 3か月10日 are one length written in two units, not a count per year or month. */
const COUNTED = /[0-9０-９〇一二三四五六七八九十百千かヵヶカケ箇個]$/u;

const endsWithPeriod = (before: string, word: string): boolean => before.endsWith(word) && !COUNTED.test(before.slice(0, before.length - word.length));

const isBeside = (period: PeriodWord, before: string, after: string): boolean =>
  period.position === "before" ? endsWithPeriod(before, period.word) : after.startsWith(period.word);

/**
 * A number with a unit of time that is not a length to add to a date: a count in each period (週3日、月10日、3 days a week) or a
 * number inside the name of a work schedule (週休2日制の2日、4週8休の4週). A count is in a unit smaller than its period: 毎年1年間 is a
 * year's length. before and after are the text next to the count, lower-cased.
 */
export const isCountPerPeriod = (count: Span & { readonly unit: DurationUnit }, before: string, after: string, words: PerPeriodWords): boolean =>
  overlapsAny(words.schedules, count) ||
  words.periods.some((period) => UNIT_ORDER.indexOf(count.unit) < UNIT_ORDER.indexOf(period.unit) && isBeside(period, before, after));
