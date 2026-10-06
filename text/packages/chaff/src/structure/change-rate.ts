// A rate of change written beside the two values it is computed from (「前年同月の1,000社から20%増えました」 with 1,200社,
// "up 20% from 1,000 companies" with 1,200 companies) that the two values do not give. Pure; the detector reads the
// figures, the rate and the words from the tree and the language's lexicons.
import type { Span } from "../plugin.ts";
import type { StructureIssue } from "./issues.ts";

/** A value with its unit as the sentence compares it (円, 社, $, companies) and the step it is written to (1 for 1,200; 1億 for 12億). */
export type Figure = Span & { readonly value: number; readonly unit: string; readonly step: number };
/** A percentage, with the number of decimals written. */
export type Rate = Span & { readonly value: number; readonly decimals: number };
/** A word that says which way the value moved (増加, up: 1; 減少, down: -1). */
export type Direction = Span & { readonly sign: 1 | -1 };
/** A word that marks a value: the earlier one after it (「1,000社から」) or before it ("from 1,000"), the later one (「1,200社に」, "to 1,200"). */
export type BaseMark = Span & { readonly position: "before" | "after" };

export type ChangeText = {
  readonly sentences: readonly Span[];
  readonly figures: readonly Figure[];
  readonly rates: readonly Rate[];
  readonly directions: readonly Direction[];
  readonly marks: readonly BaseMark[];
  /** Words that mark the later value ("to", 「に」). */
  readonly targets: readonly BaseMark[];
};

/** How far a direction word may stand from the rate (「20%の増加」「20%増えました」, "an increase of 20%", "up 20%"). */
const DIRECTION_REACH = 8;
/** How far a base mark may stand from its value ("from $10" has the currency sign between). */
const MARK_GAP = 3;
/**
 * How far the earlier value may stand from the rate (「1,000社から20%」「10億円に比べて20%」"20% from $10 million"). Further
 * away, the rate is of something else in the sentence (「100店から120店に増え、売上は15%増えた」).
 */
const BASE_REACH = 12;
const PERCENT = 100;
const HALF = 0.5;
const DECIMAL_BASE = 10;

const within = (outer: Span, inner: Span): boolean => inner.start >= outer.start && inner.end <= outer.end;

const distance = (left: Span, right: Span): number => Math.max(left.start - right.end, right.start - left.end, 0);

const markOf = (figure: Figure, marks: readonly BaseMark[]): BaseMark | undefined =>
  marks.find((mark) => {
    const gap = mark.position === "after" ? mark.start - figure.end : figure.start - mark.end;
    return gap >= 0 && gap <= MARK_GAP;
  });

/** The earlier value: marked, with the value or its mark beside the rate ("up 25% compared with $1,000"). */
const isBaseFor = (figure: Figure, rate: Rate, marks: readonly BaseMark[]): boolean => {
  const mark = markOf(figure, marks);
  return mark !== undefined && Math.min(distance(figure, rate), distance(mark, rate)) <= BASE_REACH;
};

/**
 * The later value is written before the rate (「1,200社となり、…20%増えました」"1,200 companies, up 20%") or marked as the
 * value reached (「1,200社に」"to 1,200"). Another amount after the rate is about something else ("…, and revenue was $1,300").
 */
const isCurrentFor = (figure: Figure, rate: Rate, targets: readonly BaseMark[]): boolean => figure.end <= rate.start || markOf(figure, targets) !== undefined;

/** The one sign the direction words beside the rate agree on. */
const signNear = (rate: Rate, directions: readonly Direction[]): 1 | -1 | undefined => {
  const signs = new Set(directions.filter((direction) => distance(direction, rate) <= DIRECTION_REACH).map((direction) => direction.sign));
  const [sign] = signs;
  return signs.size === 1 ? sign : undefined;
};

/**
 * The rates of change the two values allow. Each value may be off by half the step it is written to: 12億 is anything from
 * 11.5億 to 12.5億, so 12億 from 10億 is a rise of 9.5% to 31.6%, and only a rate outside that is a mistake.
 */
const rateRange = (base: Figure, current: Figure): readonly [number, number] | undefined => {
  const [baseLow, baseHigh] = [base.value - base.step * HALF, base.value + base.step * HALF];
  const [currentLow, currentHigh] = [current.value - current.step * HALF, current.value + current.step * HALF];
  if (baseLow <= 0) return undefined;
  return [(currentLow / baseHigh - 1) * PERCENT, (currentHigh / baseLow - 1) * PERCENT];
};

const issueIn = (text: ChangeText, sentence: Span): StructureIssue[] => {
  const rates = text.rates.filter((rate) => within(sentence, rate));
  const figures = text.figures.filter((figure) => within(sentence, figure));
  const [rate] = rates;
  if (rates.length !== 1 || rate === undefined) return [];
  const sign = signNear(
    rate,
    text.directions.filter((direction) => within(sentence, direction)),
  );
  const bases = figures.filter((figure) => isBaseFor(figure, rate, text.marks));
  const [base] = bases;
  if (sign === undefined || bases.length !== 1 || base === undefined) return [];
  const currents = figures.filter((figure) => figure !== base && figure.unit === base.unit && isCurrentFor(figure, rate, text.targets));
  const [current] = currents;
  const range = currents.length === 1 && current !== undefined ? rateRange(base, current) : undefined;
  if (range === undefined || current === undefined) return [];
  const written = sign * rate.value;
  const slack = HALF * DECIMAL_BASE ** -rate.decimals;
  if (written >= range[0] - slack && written <= range[1] + slack) return [];
  const computed = Math.abs((current.value / base.value - 1) * PERCENT).toFixed(rate.decimals);
  return [{ offset: rate.start, values: { rate: String(rate.value), computed } }];
};

/** Each sentence with one rate of change, one direction, one marked earlier value and one other value in its unit, that disagree. */
export const changeRateMismatches = (text: ChangeText): StructureIssue[] => text.sentences.flatMap((sentence) => issueIn(text, sentence));
