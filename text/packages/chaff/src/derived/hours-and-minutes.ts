/**
 * A computed length of time as whole hours and minutes, and which of the two a message writes: 4時間15分 / 4 hours 15
 * minutes, 7時間 / 7 hours, 45分 / 45 minutes. A part of a minute is rounded to the nearest minute (half up).
 */
export type HoursAndMinutes = {
  readonly hours: number;
  readonly minutes: number;
  /** "hours" when the minutes are 0, "minutes" under an hour (0 too), else "hours-minutes". */
  readonly shape: "hours" | "minutes" | "hours-minutes";
};

const MINUTES_PER_HOUR = 60;

/** undefined for a length that cannot be written: negative, NaN or infinite. */
export const hoursAndMinutes = (totalMinutes: number): HoursAndMinutes | undefined => {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return undefined;
  const whole = Math.round(totalMinutes);
  const hours = Math.floor(whole / MINUTES_PER_HOUR);
  const minutes = whole % MINUTES_PER_HOUR;
  if (hours === 0) return { hours, minutes, shape: "minutes" };
  return { hours, minutes, shape: minutes === 0 ? "hours" : "hours-minutes" };
};

/** Whether a computed length would be written as the stated one: a message saying "8 hours, but 8 hours is written" says nothing. */
export const readsTheSame = (computedMinutes: number, statedMinutes: number): boolean => Math.round(computedMinutes) === Math.round(statedMinutes);

const HOUR_DECIMALS = 100;

/** The computed length for a message: decimal hours as `expected` (kept for JSON readers), hours and minutes to write. */
export type ComputedLength = {
  readonly shape: HoursAndMinutes["shape"];
  readonly values: { readonly expected: number; readonly hours: number; readonly minutes: number };
};

/** undefined when the computed length cannot be written, or would be written as the stated one. */
export const computedLength = (computedMinutes: number, statedMinutes: number): ComputedLength | undefined => {
  const length = hoursAndMinutes(computedMinutes);
  if (length === undefined || readsTheSame(computedMinutes, statedMinutes)) return undefined;
  const expected = Math.round((computedMinutes / MINUTES_PER_HOUR) * HOUR_DECIMALS) / HOUR_DECIMALS;
  return { shape: length.shape, values: { expected, hours: length.hours, minutes: length.minutes } };
};
