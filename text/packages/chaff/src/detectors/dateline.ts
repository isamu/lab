// The dates that stand alone on a line, perhaps after the name of the day: a session's dateline in a hearing record
// ("WEDNESDAY, MAY 21, 2025") or minutes, which dates what is said below it. Pure.

export type LineDate = { readonly start: number; readonly end: number; readonly value: string };

const lineStartOf = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

const lineEndOf = (source: string, offset: number): number => {
  const end = source.indexOf("\n", offset);
  return end === -1 ? source.length : end;
};

/** What stands before the date on its line: nothing, or a weekday's name with an optional comma ("Wednesday,"). */
const onlyWeekdayBefore = (before: string, weekdays: readonly string[]): boolean => {
  const bare = before.trim().replace(/,$/u, "").trim().toLowerCase();
  return bare === "" || weekdays.some((weekday) => weekday !== "" && weekday.toLowerCase() === bare);
};

/** A short bracket after the date, as a weekday is written in Japanese (2025年5月21日（水）). */
const SHORT_BRACKET = /^[（(][^（）()]{1,6}[）)]$/u;

const onlyBracketAfter = (after: string): boolean => {
  const bare = after.trim();
  return bare === "" || SHORT_BRACKET.test(bare);
};

/** The dates of the source that are alone on their line, in the order given. weekdays: the language's names of the days. */
export const datelines = <D extends LineDate>(source: string, dates: readonly D[], weekdays: readonly string[]): D[] =>
  dates.filter(
    (date) =>
      date.end > date.start &&
      onlyBracketAfter(source.slice(date.end, lineEndOf(source, date.end))) &&
      onlyWeekdayBefore(source.slice(lineStartOf(source, date.start), date.start), weekdays),
  );

/** The value of the last dateline before offset, or undefined where none stands before it. */
export const datelineBefore = (lines: readonly LineDate[], offset: number): string | undefined => lines.findLast((line) => line.end <= offset)?.value;
