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
/** A calendar year written in the sentence (「2025年」, "in 2025"). */
export type Period = Span & { readonly year: number };
/** A word that starts another subject or clause; one that joins two values ("… in 2025 and …") is read only before the rate. */
export type Break = Span & { readonly beforeRateOnly: boolean };

export type ChangeText = {
  readonly sentences: readonly Span[];
  readonly figures: readonly Figure[];
  readonly rates: readonly Rate[];
  readonly directions: readonly Direction[];
  readonly marks: readonly BaseMark[];
  /** Words that mark the later value ("to", 「に」). */
  readonly targets: readonly BaseMark[];
  readonly periods: readonly Period[];
  /** Words that start another subject or clause (「利益は」, "and", ";"): a rate after one is not about the values before it. */
  readonly breaks: readonly Break[];
  /** The document's text, which the gaps of a pair are measured in. */
  readonly source: string;
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
/**
 * The two values written together, the earlier then the later or the other way round (「昨年の100万円から今年は150万円」
 * "from $1.0 million last year to $1.5 million"): how far apart they may stand, and how far after them the rate may
 * (「150万円になり、前年比20%」", an increase of 20%"). Measured with a Latin word counting as one character.
 */
const PAIR_GAP = 16;
const PAIR_REACH = 16;
/** How far a year may stand from the value it dates (「2025年の100万円」"$1.0 million in 2025"), a word counting as one. */
const PERIOD_GAP = 8;
const LATIN_WORD = /[A-Za-z]+/gu;
const PERCENT = 100;
const HALF = 0.5;
const DECIMAL_BASE = 10;

const within = (outer: Span, inner: Span): boolean => inner.start >= outer.start && inner.end <= outer.end;

const distance = (left: Span, right: Span): number => Math.max(left.start - right.end, right.start - left.end, 0);

const gapBetween = (left: Span, right: Span): Span => ({ start: left.end, end: right.start });

/** The length of a gap, a Latin word counting as one character: "an increase of" is as short as 「前年比」. */
export const gapLength = (source: string, gap: Span): number => source.slice(gap.start, gap.end).replaceAll(LATIN_WORD, "w").length;

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
type Rounded = Pick<Figure, "value" | "step">;

const rateRange = (base: Rounded, current: Rounded): readonly [number, number] | undefined => {
  const [baseLow, baseHigh] = [base.value - base.step * HALF, base.value + base.step * HALF];
  const [currentLow, currentHigh] = [current.value - current.step * HALF, current.value + current.step * HALF];
  if (baseLow <= 0) return undefined;
  return [(currentLow / baseHigh - 1) * PERCENT, (currentHigh / baseLow - 1) * PERCENT];
};

/**
 * The rate in percent the two values give, when the written rate (signed, with its decimals) is one their rounding cannot
 * reach; undefined when it can, or when the earlier value may be zero or below.
 */
export const disagreeingRate = (base: Rounded, current: Rounded, written: number, decimals: number): number | undefined => {
  const range = rateRange(base, current);
  const slack = HALF * DECIMAL_BASE ** -decimals;
  if (range === undefined || (written >= range[0] - slack && written <= range[1] + slack)) return undefined;
  return (current.value / base.value - 1) * PERCENT;
};

type Pair = { readonly base: Figure; readonly current: Figure };
/** One sentence's parts, with the rate: the one percentage that has a word of direction beside it. */
type Reading = ChangeText & { readonly rate: Rate; readonly sign: 1 | -1 };

/** A word between the two that starts another subject or clause (「100万円から150万円に増え、利益は20%」). */
const brokenBetween = (text: Reading, one: Span, other: Span): boolean => {
  const gap = one.end <= other.start ? gapBetween(one, other) : gapBetween(other, one);
  return text.breaks.some((word) => within(gap, word));
};

/** right follows left closely, with no value, rate or word of another subject or clause between them. */
const followsClosely = (text: Reading, left: Span, right: Span, reach: number): boolean => {
  const gap = gapBetween(left, right);
  if (gap.start > gap.end || gapLength(text.source, gap) > reach) return false;
  return ![...text.figures, ...text.rates, ...text.breaks].some((span) => within(gap, span));
};

/**
 * The later value is written before the rate (「1,200社となり、…20%増えました」"1,200 companies, up 20%") or marked as the
 * value reached right after the rate or the earlier value (「から20%増加し、1,200社となりました」"from 1,000 to 1,200"), in the
 * same clause. Another amount after the rate is about something else ("…, and revenue was $1,300", 「…増加し、利益は300万円に」).
 */
const isCurrentFor = (text: Reading, figure: Figure, base: Figure): boolean => {
  if (figure.end <= text.rate.start) return true;
  const from = text.rate.end < base.end && base.end <= figure.start ? base : text.rate;
  return markOf(figure, text.targets) !== undefined && followsClosely(text, from, figure, BASE_REACH) && !brokenBetween(text, text.rate, figure);
};

/** The earlier value marked beside the rate, and the one value in its unit before the rate or marked as reached. */
const besideRate = (text: Reading): Pair | undefined => {
  const bases = text.figures.filter((figure) => isBaseFor(figure, text.rate, text.marks) && !brokenBetween(text, figure, text.rate));
  const [base] = bases;
  if (bases.length !== 1 || base === undefined) return undefined;
  const currents = text.figures.filter((figure) => figure !== base && figure.unit === base.unit && isCurrentFor(text, figure, base));
  const [current] = currents;
  return currents.length === 1 && current !== undefined ? { base, current } : undefined;
};

/**
 * The value reached right after the rate, and the earlier value right after it ("rose 12% to $2,640 million from $2,400
 * million"): the earlier value stands too far from the rate to be read beside it.
 */
const reachedThenBase = (text: Reading): Pair | undefined => {
  const pairs = text.figures.flatMap((current, index) => {
    const base = text.figures[index + 1];
    if (base?.unit !== current.unit || markOf(current, text.targets) === undefined || markOf(base, text.marks) === undefined) return [];
    return followsClosely(text, text.rate, current, BASE_REACH) && followsClosely(text, current, base, PAIR_GAP) ? [{ base, current }] : [];
  });
  const [pair] = pairs;
  return pairs.length === 1 ? pair : undefined;
};

const yearsBeside = (text: Reading, figure: Figure, side: "before" | "after", bound: Span): Period[] =>
  text.periods.filter((period) => {
    const [left, right] = side === "before" ? [period, figure] : [figure, period];
    return left.end <= right.start && within(bound, period) && gapLength(text.source, gapBetween(left, right)) <= PERIOD_GAP;
  });

/**
 * Of two values each dated by a year, the earlier year's. The years stand on the same side of both values: before them
 * (「2025年は100万円、2026年は150万円」) or after them ("$1.0 million in 2025 and $1.5 million in 2026").
 */
const datedEarlier = (text: Reading, first: Figure, second: Figure): Figure | undefined => {
  const middle = gapBetween(first, second);
  const sides = [
    [yearsBeside(text, first, "before", { start: 0, end: first.start }), yearsBeside(text, second, "before", middle)],
    [yearsBeside(text, first, "after", middle), yearsBeside(text, second, "after", { start: second.end, end: text.source.length })],
  ].filter(([early, late]) => early?.length === 1 && late?.length === 1);
  const [[early, late] = []] = sides;
  const [firstYear, secondYear] = [early?.[0]?.year, late?.[0]?.year];
  if (sides.length !== 1 || firstYear === undefined || secondYear === undefined || firstYear === secondYear) return undefined;
  return firstYear < secondYear ? first : second;
};

/** Which of two values written together is the earlier: the one marked (「から」, "from", 「前年の」), else the one dated earlier. */
const pairOf = (text: Reading, first: Figure, second: Figure): Pair | undefined => {
  const marked = [first, second].filter((figure) => markOf(figure, text.marks) !== undefined);
  if (marked.length > 1) return undefined;
  const base = marked[0] ?? datedEarlier(text, first, second);
  if (base === undefined) return undefined;
  return { base, current: base === first ? second : first };
};

/** Nothing between the later value and the rate that makes the rate another one's: a value, another subject, another base. */
const leadsTo = (text: Reading, second: Figure): boolean => {
  const gap = gapBetween(second, text.rate);
  if (gap.start > gap.end || gapLength(text.source, gap) > PAIR_REACH) return false;
  return ![...text.figures, ...text.breaks, ...text.marks].some((span) => within(gap, span));
};

/** Two values of one subject written close, with no rate between them (「売上は100万円、費用は150万円」 is two subjects). */
const standTogether = (text: Reading, first: Figure, second: Figure): boolean => {
  const gap = gapBetween(first, second);
  const inGap = (span: Span): boolean => within(gap, span);
  if (gapLength(text.source, gap) > PAIR_GAP || text.rates.some(inGap)) return false;
  return !text.breaks.some((word) => !word.beforeRateOnly && inGap(word));
};

/** The two values written together right before the rate (「昨年の100万円から今年は150万円になり、前年比20%の増加」). */
const beforeRate = (text: Reading): Pair | undefined => {
  const pairs = text.figures.flatMap((first, index) => {
    const second = text.figures.slice(index + 1).find((figure) => figure.unit === first.unit);
    const pair = second !== undefined && standTogether(text, first, second) && leadsTo(text, second) ? pairOf(text, first, second) : undefined;
    return pair === undefined ? [] : [pair];
  });
  const [pair] = pairs;
  return pairs.length === 1 ? pair : undefined;
};

/**
 * The sentence's one rate with a word of direction beside it, a word counting for the rate it stands nearest. A percentage
 * without one (「20%の増加、利益率は10%」) is about something else.
 */
const readingIn = (text: ChangeText, sentence: Span): Reading | undefined => {
  const inSentence = (span: Span): boolean => within(sentence, span);
  const directions = text.directions.filter(inSentence);
  const rates = text.rates.filter(inSentence);
  const nearestTo = (rate: Rate, direction: Direction): boolean => rates.every((other) => distance(direction, rate) <= distance(direction, other));
  const signed = rates.flatMap((rate) => {
    const sign = signNear(
      rate,
      directions.filter((direction) => nearestTo(rate, direction)),
    );
    return sign === undefined ? [] : [{ rate, sign }];
  });
  const [only] = signed;
  if (signed.length !== 1 || only === undefined) return undefined;
  const parts = {
    figures: text.figures.filter(inSentence).toSorted((left, right) => left.start - right.start),
    periods: text.periods.filter(inSentence),
    breaks: text.breaks.filter(inSentence),
  };
  return { ...text, ...parts, ...only, rates };
};

const issueIn = (text: ChangeText, sentence: Span): StructureIssue[] => {
  const reading = readingIn(text, sentence);
  const pair = reading === undefined ? undefined : (besideRate(reading) ?? beforeRate(reading) ?? reachedThenBase(reading));
  if (reading === undefined || pair === undefined) return [];
  const { rate, sign } = reading;
  const computed = disagreeingRate(pair.base, pair.current, sign * rate.value, rate.decimals);
  if (computed === undefined) return [];
  return [{ offset: rate.start, values: { rate: String(rate.value), computed: Math.abs(computed).toFixed(rate.decimals) } }];
};

/**
 * Each sentence with one rate of change and its direction, and the two values it is computed from, that disagree: the
 * earlier value marked beside the rate, the two values written together right before it, or the value reached and then
 * the earlier one right after it.
 */
export const changeRateMismatches = (text: ChangeText): StructureIssue[] => text.sentences.flatMap((sentence) => issueIn(text, sentence));
