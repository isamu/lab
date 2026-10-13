import { mentions } from "./date-outside-period.ts";
import type { DatedPoint } from "./due-date.ts";
import type { StructureIssue } from "./issues.ts";
import { lineNumberAt, linesOf, type Line } from "./lines.ts";
import { isTotalLabel } from "./total.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";

/**
 * 催しの後の申込締切。催しの日の語で始まり時刻のある一行（日時：2026年11月20日（金）14:00〜）が催しの日を書き、
 * 申込の語（申込、RSVP）と締め切りの語（までに、by）のある文か行の、年のある日付がどの催しの日よりも後なら指す。
 * 時刻を求めるのは、手紙の頭の「Date: …」を催しの日と読まないため。催しの後に来てよいもの（アンケート、支払）の語が同じ文にあれば比べない。
 * 文か行に日付が二つ以上あれば、どれが締め切りか分からないので比べない。
 * チケットの注文（題名にチケットの語があり、請求書の語が無い文書）では、支払の期限も締め切りと読む。請求書なら支払は催しの後でよい。
 * 旅行の知らせ（題名に旅行の語があり、請求書の語が無い文書）では、出発の語で始まる行（出発日：、期間：）の最初の日付を時刻が無くても催しの日と読み、
 * 納入期限の語のある文か、その語を列の見出しにした表の升の日付を支払の期限と読む。請求書の「期間」は請求の期間で、旅行ではない。Pure.
 */
export type EventDeadlineWords = {
  readonly events: readonly string[];
  readonly registrations: readonly string[];
  readonly deadlines: readonly string[];
  readonly asides: readonly string[];
  readonly tickets: readonly string[];
  readonly payments: readonly string[];
  readonly bills: readonly string[];
  readonly trips: readonly string[];
  readonly starts: readonly string[];
  readonly paymentDeadlines: readonly string[];
  readonly dues: readonly string[];
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

const MONTH_DAY = /^\d{2}-\d{2}$/u;
const YEAR_LENGTH = 4;

/**
 * 期間の始まりの日。年を書かない始まり（October 14 – Friday, October 16, 2026）は終わりの年を借り、始まりの月が終わりの月より後なら
 * （December 30 – January 2, 2027）その前の年。同じ月で日が逆さまの期間は、逆さまのまま同じ年に置く。
 */
export const rangeStartOf = (values: readonly string[]): string | undefined => {
  const [first, ...rest] = values;
  if (first === undefined || FULL_DATE.test(first)) return first;
  const end = rest.find((value) => FULL_DATE.test(value));
  if (!MONTH_DAY.test(first) || end === undefined) return undefined;
  const year = Number(end.slice(0, YEAR_LENGTH));
  const crossesYear = first.slice(0, 2) > end.slice(YEAR_LENGTH + 1, YEAR_LENGTH + 3);
  return `${String(crossesYear ? year - 1 : year)}-${first}`;
};

/** 旅行の始まりの日: 出発の語で始まる行の、最初の日付。期間（10月14日〜16日）なら始まりの日。 */
const tripStartOf = (line: Line, dates: readonly DatedPoint[], words: EventDeadlineWords): string | undefined =>
  isTotalLabel(line.text, words.starts) ? rangeStartOf(datesIn(dates, { start: line.start, end: endOf(line) }).map((date) => date.value)) : undefined;

/** 日付を囲む文を、その行の中に切ったもの。文が見つからなければ行。 */
const unitOf = (offset: number, line: Line, sentences: readonly Span[]): Span => {
  const sentence = sentences.find((span) => span.start <= offset && offset < span.end);
  return { start: Math.max(sentence?.start ?? line.start, line.start), end: Math.min(sentence?.end ?? endOf(line), endOf(line)) };
};

/** 申込の締め切りを書いた文か: 申込の語と締め切りの語があり、催しの後に来てよいものの語が無い。 */
export const isRegistrationDeadline = (text: string, words: EventDeadlineWords): boolean =>
  mentions(text, words.registrations) && mentions(text, words.deadlines) && !mentions(text, words.asides);

/** 催しの後に来てよいものの語のうち、支払の語でないもの（アンケート、返金）。 */
const asidesBesidesPayment = (words: EventDeadlineWords): readonly string[] =>
  words.asides.filter((aside) => !words.payments.some((payment) => payment.toLowerCase() === aside.toLowerCase()));

/** チケットの注文の支払期限を書いた文か: 支払の語と締め切りの語があり、支払の語のほかに催しの後に来てよいものの語が無い。 */
export const isTicketPaymentDeadline = (text: string, words: EventDeadlineWords): boolean =>
  mentions(text, words.payments) && mentions(text, words.deadlines) && !mentions(text, asidesBesidesPayment(words));

/** チケットの注文か: 題名（最初の見出し）にチケットの語があり、文書のどこにも請求書の語が無い。 */
export const isTicketOrder = (title: string | undefined, source: string, words: EventDeadlineWords): boolean =>
  title !== undefined && mentions(title, words.tickets) && !mentions(title, words.bills) && !mentions(source, words.bills);

/** 旅行の知らせか: 題名（最初の見出し）に旅行の語があり、文書のどこにも請求書の語が無い。 */
export const isTripNotice = (title: string | undefined, source: string, words: EventDeadlineWords): boolean =>
  title !== undefined && mentions(title, words.trips) && !mentions(title, words.bills) && !mentions(source, words.bills);

/**
 * 旅行の代金の期限を書いた文か: 納入期限の語があるか、支払の語と締め切りか期日の語がある（Second payment: $60, due …）。
 * heading は日付のある表の升の列の見出しで、文と合わせて読む（見出しが Due by、行が 2nd payment）。
 * 支払の語のほかに催しの後に来てよいものの語（返金、精算）があれば読まない。期日の語（due）は旅行の知らせでだけ読む。
 */
export const isTripPaymentDeadline = (text: string, heading: string | undefined, words: EventDeadlineWords): boolean => {
  const read = heading === undefined ? text : `${heading} ${text}`;
  if (mentions(read, asidesBesidesPayment(words))) return false;
  return mentions(read, words.paymentDeadlines) || (mentions(read, words.payments) && mentions(read, [...words.deadlines, ...words.dues]));
};

type Reading = {
  readonly title: string | undefined;
  readonly source: string;
  readonly lines: readonly Line[];
  readonly dates: readonly DatedPoint[];
  readonly sentences: readonly Span[];
  /** 表の本体の行の番号から、その表の見出しの行。 */
  readonly tableHeaders: ReadonlyMap<number, Line>;
};

/** 締め切りとして読んだ道。payment はチケットの注文か旅行の知らせの支払期限で、知らせの言い方を変える。 */
export type DeadlineKind = "registration" | "payment";

export type DeadlineIssue = StructureIssue & { readonly kind: DeadlineKind };

/** heading は日付が表の升にあるときの、その列の見出し。 */
type ReadDeadline = (text: string, heading: string | undefined) => DeadlineKind | undefined;

const deadlineReaderOf = (reading: Reading, words: EventDeadlineWords): ReadDeadline => {
  const ticketOrder = isTicketOrder(reading.title, reading.source, words);
  const tripNotice = isTripNotice(reading.title, reading.source, words);
  return (text, heading) => {
    if (ticketOrder && isTicketPaymentDeadline(text, words)) return "payment";
    if (tripNotice && isTripPaymentDeadline(text, heading, words)) return "payment";
    return isRegistrationDeadline(text, words) ? "registration" : undefined;
  };
};

const tableHeadersOf = (lines: readonly Line[]): Map<number, Line> =>
  new Map(tablesOf(lines).flatMap(({ header, rows }) => rows.map((row): [number, Line] => [row.number, header])));

/** offset が表の本体の升にあれば、その列の見出しの字。 */
const columnHeadingAt = (reading: Reading, line: Line, offset: number): string | undefined => {
  const header = reading.tableHeaders.get(line.number);
  if (header === undefined) return undefined;
  const column = cellsOf(line).findIndex((cell) => cell.start <= offset && offset < cell.end);
  return column === -1 ? undefined : cellsOf(header)[column]?.text;
};

const lateDeadlines = (reading: Reading, readDeadline: ReadDeadline, event: string): DeadlineIssue[] =>
  reading.dates.flatMap((date) => {
    if (!FULL_DATE.test(date.value) || date.value <= event) return [];
    const line = reading.lines[(lineNumberAt(reading.lines, date.offset) ?? 0) - 1];
    if (line === undefined) return [];
    const unit = unitOf(date.offset, line, reading.sentences);
    if (datesIn(reading.dates, unit).length > 1) return [];
    const kind = readDeadline(reading.source.slice(unit.start, unit.end), columnHeadingAt(reading, line, date.offset));
    if (kind === undefined) return [];
    return [{ offset: date.offset, kind, values: { deadline: date.value, event } }];
  });

/** 催しの日: 催しの日の行の日付と、旅行の知らせなら出発の行の日付の、いちばん後のもの。 */
const eventOf = (reading: Reading, words: EventDeadlineWords): string | undefined => {
  const trip = isTripNotice(reading.title, reading.source, words);
  return latestOf(
    reading.lines.flatMap((line) =>
      [eventDayOf(line, reading.dates, words), trip ? tripStartOf(line, reading.dates, words) : undefined].flatMap((day) => day ?? []),
    ),
  );
};

/** title は文書の最初の見出しの言葉（無ければ undefined）。 */
export const deadlinesAfterEvent = (
  source: string,
  dates: readonly DatedPoint[],
  sentences: readonly Span[],
  words: EventDeadlineWords,
  title?: string,
): DeadlineIssue[] => {
  if (words.events.length === 0 || words.registrations.length === 0 || words.deadlines.length === 0) return [];
  const lines = linesOf(source);
  const reading = { title, source, lines, dates, sentences, tableHeaders: tableHeadersOf(lines) };
  const event = eventOf(reading, words);
  if (event === undefined) return [];
  return lateDeadlines(reading, deadlineReaderOf(reading, words), event);
};
