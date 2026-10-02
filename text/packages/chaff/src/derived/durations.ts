import type { Span } from "../plugin.ts";
import { bySentence } from "./sentence-buckets.ts";
import { calendarDateOf, dateOf, shifted, valueOf, type DurationUnit } from "./date-arithmetic.ts";

/**
 * 始まりと期間と終わりを一つの文に書いたもの（「4月1日から3か月間（6月30日まで）」"for 3 months from April 1, 2026 (until
 * June 30, 2026)"）。始まりに期間を足した日が終わりと合わなければ言う。期間の数え方は三通りある。終わりの日を含めて数える
 * （4月1日から3か月間は6月30日まで）か、含めずに数える（7月1日まで）か、初日を数えずに期間が過ぎた日（「到達日から2週間が経過した日
 * （4月16日）」）。どれとも合わないときだけ言う。
 * 文に日付がちょうど二つ、期間がちょうど一つのときだけ読む。それより多い文は、どの日付とどの期間が組なのか決まらない。
 */
export type DatedValue = Span & { readonly value: string };

export type Duration = Span & { readonly amount: number; readonly unit: DurationUnit };

export type DurationMismatch = { readonly start: DatedValue; readonly duration: Duration; readonly end: DatedValue; readonly expected: string };

/** 期間を足した日と、その前の日（終わりを含めて数える）と、次の日（初日を数えずに期間が過ぎた日）。 */
const expectedEnds = (start: Date, duration: Duration): Date[] => {
  const exclusive = shifted(start, duration.amount, duration.unit);
  return [shifted(exclusive, -1, "day"), exclusive, shifted(exclusive, 1, "day")];
};

/** 年まで書いた二つの日付は、早いほうを始まりにする（「7月1日まで、4月1日から3か月」）。月日だけなら書いた順（年をまたぐことがある）。 */
const ordered = (first: DatedValue, second: DatedValue, withYear: boolean): [DatedValue, DatedValue] =>
  withYear && second.value < first.value ? [second, first] : [first, second];

const mismatchOf = (written: readonly [DatedValue, DatedValue], duration: Duration): DurationMismatch | undefined => {
  const [firstDate, secondDate] = [calendarDateOf(written[0].value), calendarDateOf(written[1].value)];
  if (firstDate === undefined || secondDate === undefined || (firstDate.year === undefined) !== (secondDate.year === undefined)) return undefined;
  const withYear = firstDate.year !== undefined;
  const [start, end] = ordered(written[0], written[1], withYear);
  const startDate = calendarDateOf(start.value);
  if (startDate === undefined) return undefined;
  const ends = expectedEnds(dateOf(startDate), duration);
  const [inclusive] = ends;
  if (inclusive === undefined || ends.some((candidate) => valueOf(candidate, withYear) === end.value)) return undefined;
  return { start, duration, end, expected: valueOf(inclusive, withYear) };
};

/** 一つの文の中の、始まり・期間・終わり。 */
export const durationMismatches = (sentences: readonly Span[], dates: readonly DatedValue[], durations: readonly Duration[]): DurationMismatch[] => {
  const datesIn = bySentence(sentences, dates);
  return [...bySentence(sentences, durations).entries()].flatMap(([index, inDurations]) => {
    const inDates = datesIn.get(index) ?? [];
    const [first, second] = inDates;
    const [duration] = inDurations;
    if (inDates.length !== 2 || inDurations.length !== 1 || first === undefined || second === undefined || duration === undefined) return [];
    const mismatch = mismatchOf([first, second], duration);
    return mismatch === undefined ? [] : [mismatch];
  });
};
