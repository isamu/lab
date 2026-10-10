import type { Span } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import type { Mark } from "../structure/time-marks.ts";
import {
  asciiDigits,
  isLimited,
  lastIndexAtOrBefore,
  periodCounts,
  periodsIn,
  windowStart,
  type LimitWords,
  type PeriodCount,
  type PeriodCountWords,
} from "./period-counts.ts";

/**
 * The amount of one use times the uses in a period, against the maximum stated for that period (1回2錠を1日3回、1日の最大量は
 * 4錠; 2 tablets at a time, 3 times a day, no more than 4 tablets in 24 hours). Read in one paragraph holding exactly one
 * labelled amount of one use, one count of uses in a period and one maximum in the same unit for the same period. Pure.
 */
type UseAmount = Span & { readonly amount: number; readonly unit: string };

export type UseMaximumWords = PeriodCountWords &
  LimitWords & {
    /** What makes an amount the amount of one use: before it (1回2錠) or right after it (2 tablets at a time). */
    readonly perUse: readonly Mark[];
  };

export type ExceededMaximum = {
  readonly perUse: UseAmount;
  readonly count: PeriodCount;
  readonly maximum: UseAmount;
  /** The amount of one use times the count. */
  readonly expected: number;
};

type Maximum = UseAmount & { readonly hours: number };

/** A number and the unit written right after it (2錠, 3,000円, 4 tablets). A number in a range (1〜2錠) is not read. */
const AMOUNT = /(?<![\p{N}.,．〜~\-–])(\p{Nd}+(?:[,，]\p{Nd}{3})*(?:[.．]\p{Nd}+)?)\s?([\p{Script=Han}\p{Script=Katakana}ー]{1,6}|[A-Za-zµμ]+)/gu;

const LATIN_PLURAL = /^([a-z]{2,})s$/u;

/** 錠 and 錠, tablet and tablets: the unit with its case and an English plural s taken off. */
const unitKey = (unit: string): string => {
  const lower = unit.normalize("NFKC").toLowerCase();
  return LATIN_PLURAL.exec(lower)?.[1] ?? lower;
};

/** The characters of text that taken covers. */
const coverOf = (length: number, taken: readonly Span[]): Uint8Array => {
  const cover = new Uint8Array(length);
  taken.forEach((span) => cover.fill(1, span.start, span.end));
  return cover;
};

const amountsIn = (text: string, taken: readonly Span[]): UseAmount[] => {
  const cover = coverOf(text.length, taken);
  return [...text.matchAll(AMOUNT)].flatMap((match): UseAmount[] => {
    const span = { start: match.index, end: match.index + match[0].length };
    const amount = Number((match[1] ?? "").normalize("NFKC").replace(/,/gu, ""));
    if (cover.subarray(span.start, span.end).includes(1) || !Number.isFinite(amount)) return [];
    return [{ ...span, amount, unit: unitKey(match[2] ?? "") }];
  });
};

const lower = (text: string): string => text.toLowerCase();

const LABEL_GAP = /^[\s,、]*/u;
const LABEL_SEPARATORS = new Set([" ", "\t", "\u3000", ":", "："]);

/** 1回量：2錠 reads its label past the colon. */
const withoutSeparatorsAtEnd = (text: string): string => {
  let end = text.length;
  while (end > 0 && LABEL_SEPARATORS.has(text.charAt(end - 1))) end -= 1;
  return text.slice(0, end);
};
/** How far around an amount its label is looked for, in characters. */
const LABEL_REACH = 32;

/** 1回2錠: the label right before the number. 2 tablets at a time: right after the unit. */
const isLabelled = (text: string, amount: UseAmount, labels: readonly Mark[]): boolean => {
  const before = withoutSeparatorsAtEnd(lower(text.slice(Math.max(0, amount.start - LABEL_REACH), amount.start)));
  const after = lower(text.slice(amount.end, amount.end + LABEL_REACH));
  const gap = LABEL_GAP.exec(after)?.[0].length ?? 0;
  return labels.some((label) =>
    (label.position ?? "before") === "before"
      ? before.endsWith(lower(label.pattern))
      : new RegExp(`^${escapeRegExp(lower(label.pattern))}(?![a-z])`, "u").test(after.slice(gap)),
  );
};

const COUNT_GAP = /^[\s,、を]*/u;
const SPACES = /^\s*/u;

/** Where the count would start after amount: past commas, を, and a limit word ("2 tablets, up to 3 times a day"). */
const countStartAfter = (text: string, amount: UseAmount, words: LimitWords): number => {
  const from = amount.end + (COUNT_GAP.exec(text.slice(amount.end, amount.end + LABEL_REACH))?.[0].length ?? 0);
  const rest = lower(text.slice(from, from + LABEL_REACH));
  const limit = words.limits.find((mark) => (mark.position ?? "before") === "before" && new RegExp(`^${escapeRegExp(lower(mark.pattern))}\\s`, "u").test(rest));
  if (limit === undefined) return from;
  const after = from + limit.pattern.length;
  return after + (SPACES.exec(text.slice(after, after + LABEL_REACH))?.[0].length ?? 0);
};

type Period = Span & { readonly hours: number };

type Periods = { readonly all: readonly Period[]; readonly ends: readonly number[]; readonly byStart: ReadonlyMap<number, number> };

const periodsOf = (all: readonly Period[]): Periods => ({
  all,
  ends: all.map((period) => period.end),
  byStart: new Map(all.map((period) => [period.start, period.hours])),
});

/** The period of a maximum: right after it (4 tablets in 24 hours), or the last in its window (1日の最大量は). */
const periodOf = (text: string, amount: UseAmount, from: number, periods: Periods): number | undefined => {
  const at = amount.end + (SPACES.exec(text.slice(amount.end, amount.end + LABEL_REACH))?.[0].length ?? 0);
  const before = periods.all[lastIndexAtOrBefore(periods.ends, amount.start)];
  return periods.byStart.get(at) ?? (before !== undefined && before.start >= from ? before.hours : undefined);
};

type Reading = { readonly perUse: UseAmount[]; readonly maxima: Maximum[]; readonly counts: PeriodCount[] };

const readingOf = (text: string, words: UseMaximumWords): Reading => {
  const counts = periodCounts(text, words);
  const periods = periodsOf(periodsIn(text, words));
  const amounts = amountsIn(text, [...counts, ...periods.all]);
  const countStarts = new Set(counts.map((count) => count.start));
  const perUse = new Set(amounts.filter((amount) => isLabelled(text, amount, words.perUse) || countStarts.has(countStartAfter(text, amount, words))));
  const takenEnds = [...counts, ...amounts].map((span) => span.end).toSorted((left, right) => left - right);
  const maxima = amounts.flatMap((amount): Maximum[] => {
    const from = windowStart(text, amount.start, takenEnds);
    const hours = perUse.has(amount) || !isLimited(text, amount, from, words) ? undefined : periodOf(text, amount, from, periods);
    return hours === undefined ? [] : [{ ...amount, hours }];
  });
  return { perUse: [...perUse], maxima, counts };
};

const inside = (scope: Span) => (span: Span) => span.start >= scope.start && span.end <= scope.end;

const exceededIn = (scope: Span, reading: Reading): ExceededMaximum | undefined => {
  const [perUse, counts, maxima] = [reading.perUse.filter(inside(scope)), reading.counts.filter(inside(scope)), reading.maxima.filter(inside(scope))];
  const [one, count, maximum] = [perUse[0], counts[0], maxima[0]];
  if (perUse.length !== 1 || counts.length !== 1 || maxima.length !== 1 || one === undefined || count === undefined || maximum === undefined) return undefined;
  if (one.unit !== maximum.unit || count.hours !== maximum.hours) return undefined;
  const expected = one.amount * count.amount;
  return expected > maximum.amount ? { perUse: one, count, maximum, expected } : undefined;
};

/** Maxima below the amount of one use times the uses in the same period. scopes are the paragraphs to read in. */
export const exceededMaxima = (written: string, scopes: readonly Span[], words: UseMaximumWords): ExceededMaximum[] => {
  const reading = readingOf(asciiDigits(written), words);
  return scopes.flatMap((scope) => {
    const found = exceededIn(scope, reading);
    return found === undefined ? [] : [found];
  });
};
