// A yearless date that carries on a dated account: "On April 21, 1952, … on April 30 … on May 3 … May 12". Each date
// goes forward from the one before it, back to a date with its year a little earlier in the text, so the reader
// carries that year on. Pure.
import { withNearestYear } from "../structure/weekday.ts";

type Point = { readonly offset: number; readonly value: string };

const FULL = /^(\d{4})-(\d{2}-\d{2})$/u;
const MONTH_DAY = /^\d{2}-\d{2}$/u;

/** How far back in the text the dated date may stand: a paragraph or two of one account. */
export const RUN_REACH_CHARS = 2000;

/** The year of the nearest dated date before from, no further than RUN_REACH_CHARS before point. */
const datedYearBefore = <P extends Point>(point: P, from: P, previousOf: (point: P) => P | undefined): string | undefined => {
  const earlier = previousOf(from);
  if (earlier === undefined || point.offset - earlier.offset > RUN_REACH_CHARS) return undefined;
  return FULL.exec(earlier.value)?.[1] ?? datedYearBefore(point, earlier, previousOf);
};

/**
 * Whether point (a month and day) continues a run of dates that goes forward from a dated date: every date between them
 * is a month and day no later than the next, the month and day falls in the dated date's year within a few months of
 * it, and the dated date before that one has the same year, so the account keeps to one year ("April 9, 1952 … April
 * 21, 1952 … April 30"). Every date read is at most RUN_REACH_CHARS before point. previousOf gives the date before each.
 */
export const continuesDatedRun = <P extends Point>(point: P, previousOf: (point: P) => P | undefined): boolean =>
  MONTH_DAY.test(point.value) && runsBackFrom(point, point, previousOf);

/** Walks back from later, a month and day of the run that ends at point, to the dated date the run starts from. */
const runsBackFrom = <P extends Point>(point: P, later: P, previousOf: (point: P) => P | undefined): boolean => {
  const earlier = previousOf(later);
  if (earlier === undefined || point.offset - earlier.offset > RUN_REACH_CHARS) return false;
  const full = FULL.exec(earlier.value);
  if (full === null) return MONTH_DAY.test(earlier.value) && earlier.value <= later.value && runsBackFrom(point, earlier, previousOf);
  const year = full[1] ?? "";
  const inYear = (full[2] ?? "") <= later.value && withNearestYear(point.value, earlier.value)?.startsWith(year) === true;
  return inYear && datedYearBefore(point, earlier, previousOf) === year;
};
