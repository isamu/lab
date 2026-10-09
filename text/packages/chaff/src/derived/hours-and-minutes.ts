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
