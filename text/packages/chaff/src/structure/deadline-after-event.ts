import { mentions } from "./date-outside-period.ts";
import type { DatedPoint } from "./due-date.ts";
import type { StructureIssue } from "./issues.ts";
import { lineNumberAt, linesOf, type Line } from "./lines.ts";
import { isTotalLabel } from "./total.ts";

/**
 * 催しの後の申込締切。催しの日の語で始まり時刻のある一行（日時：2026年11月20日（金）14:00〜）が催しの日を書き、
 * 申込の語（申込、RSVP）と締め切りの語（までに、by）のある文か行の、年のある日付がどの催しの日よりも後なら指す。
 * 時刻を求めるのは、手紙の頭の「Date: …」を催しの日と読まないため。催しの後に来てよいもの（アンケート、支払）の語が同じ文にあれば比べない。
 * 文か行に日付が二つ以上あれば、どれが締め切りか分からないので比べない。Pure.
 */
export type EventDeadlineWords = {
  readonly events: readonly string[];
  readonly registrations: readonly string[];
  readonly deadlines: readonly string[];
  readonly asides: readonly string[];
};

type Span = { readonly start: number; readonly end: number };

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const CLOCK_TIME = /(?<!\d)\d{1,2}[:：]\d{2}(?!\d)/u;

/** 年月日（2026-11-20）の並びでいちばん後のもの。字の順が日付の順になる。 */
const latestOf = (values: readonly string[]): string | undefined =>
  values.reduce<string | undefined>((latest, value) => (latest === undefined || value > latest ? value : latest), undefined);

const endOf = (line: Line): number => line.start + line.text.length;

const datesIn = (dates: readonly DatedPoint[], span: Span): DatedPoint[] => dates.filter((date) => date.offset >= span.start && date.offset < span.end);

/** 催しの日: 催しの日の語で始まり、時刻と年のある日付を書いた行の、いちばん後の日付。 */
const eventDayOf = (line: Line, dates: readonly DatedPoint[], words: EventDeadlineWords): string | undefined => {
  if (!isTotalLabel(line.text, words.events) || !CLOCK_TIME.test(line.text)) return undefined;
  const values = datesIn(dates, { start: line.start, end: endOf(line) }).map((date) => date.value);
  return latestOf(values.filter((value) => FULL_DATE.test(value)));
};

/** 日付を囲む文を、その行の中に切ったもの。文が見つからなければ行。 */
const unitOf = (offset: number, line: Line, sentences: readonly Span[]): Span => {
  const sentence = sentences.find((span) => span.start <= offset && offset < span.end);
  return { start: Math.max(sentence?.start ?? line.start, line.start), end: Math.min(sentence?.end ?? endOf(line), endOf(line)) };
};

/** 申込の締め切りを書いた文か: 申込の語と締め切りの語があり、催しの後に来てよいものの語が無い。 */
export const isRegistrationDeadline = (text: string, words: EventDeadlineWords): boolean =>
  mentions(text, words.registrations) && mentions(text, words.deadlines) && !mentions(text, words.asides);

type Reading = { readonly source: string; readonly lines: readonly Line[]; readonly dates: readonly DatedPoint[]; readonly sentences: readonly Span[] };

const lateDeadlines = (reading: Reading, words: EventDeadlineWords, event: string): StructureIssue[] =>
  reading.dates.flatMap((date) => {
    if (!FULL_DATE.test(date.value) || date.value <= event) return [];
    const line = reading.lines[(lineNumberAt(reading.lines, date.offset) ?? 0) - 1];
    if (line === undefined) return [];
    const unit = unitOf(date.offset, line, reading.sentences);
    if (datesIn(reading.dates, unit).length > 1 || !isRegistrationDeadline(reading.source.slice(unit.start, unit.end), words)) return [];
    return [{ offset: date.offset, values: { deadline: date.value, event } }];
  });

export const deadlinesAfterEvent = (source: string, dates: readonly DatedPoint[], sentences: readonly Span[], words: EventDeadlineWords): StructureIssue[] => {
  if (words.events.length === 0 || words.registrations.length === 0 || words.deadlines.length === 0) return [];
  const lines = linesOf(source);
  const event = latestOf(lines.flatMap((line) => eventDayOf(line, dates, words) ?? []));
  return event === undefined ? [] : lateDeadlines({ source, lines, dates, sentences }, words, event);
};
