import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { quoteAround } from "./quote-around.ts";
import { yearDisagreements } from "./gloss-year.ts";

// 暦に無い日付（2月30日、4月31日、2023-02-29）。月の長さとうるう年は暦で決まるので、書き損じは機械で言える。
// 月の名前は語彙表 month-name（初めの十二が一月から順に）、年月日の単位は date-time-unit（大きい順の初めの三つ）、元号は calendar-era が言う。

/** 日付を読むのに要る語。months は一月から順の月の名前と略した名前、units は年・月・日の単位、eras は元号。 */
export type CalendarWords = { readonly months: readonly string[]; readonly units: readonly string[]; readonly eras: readonly string[] };

/** 暦に無い日付 1 つ。reason は、月が無い（month）、その月にその日が無い（day）、うるう年でない年の 2 月 29 日（leap）。 */
export type ImpossibleDate = {
  readonly offset: number;
  readonly written: string;
  readonly reason: "month" | "day" | "leap";
  readonly month: number;
  readonly days: number;
};

const DIGIT = "[0-9０-９]";
const NOT_AFTER_NUMBER = "(?<![\\w/.\\-０-９])";
/** 日付の後ろに来ない字。ただし日時（2023-02-29T10:00）の T は日付の終わり。 */
const NOT_BEFORE_NUMBER = "(?:(?=T\\d)|(?![\\w/／\\-０-９]|\\.\\w))";
const MONTHS_IN_YEAR = 12;
const LONGEST_MONTH = 31;
const FEBRUARY = 2;
const LEAP_DAY = 29;
const FIRST_CALENDAR_YEAR = 1000;
const DAYS_IN_MONTH: readonly number[] = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const FULLWIDTH_OFFSET = 0xfee0;

const halfWidth = (text: string): string => text.replace(/[０-９]/gu, (char) => String.fromCharCode(char.charCodeAt(0) - FULLWIDTH_OFFSET));

const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** 書き方ごとの読み方。strict は数の組が日付だと単位や名前で分かる形で、月が 1〜12 にない・日が 31 を超えるのも言う。 */
type Shape = { readonly pattern: RegExp; readonly strict: boolean };

/** 年の数。元号の年や 4 桁でない年は、うるう年を決められないので undefined。 */
const yearOf = (groups: Readonly<Record<string, string | undefined>>): number | undefined => {
  const written = groups["y"];
  if (written === undefined || groups["era"] !== undefined) return undefined;
  const year = Number(halfWidth(written));
  return year >= FIRST_CALENDAR_YEAR ? year : undefined;
};

/** 一月から順の月の名前（初めの十二）で、略した名前（Sept、Feb.）が何月か。 */
const monthNamed = (months: readonly string[], written: string): number => {
  const name = written.replace(/\.$/u, "");
  return months.slice(0, MONTHS_IN_YEAR).findIndex((full) => full.startsWith(name)) + 1;
};

type Groups = Readonly<Record<string, string | undefined>>;

const monthOf = (groups: Groups, months: readonly string[]): number =>
  groups["name"] === undefined ? Number(halfWidth(groups["m"] ?? "")) : monthNamed(months, groups["name"]);

/** その月の日数。2 月は、年が分かってうるう年でなければ 28 日、分からなければ 29 日。 */
const daysIn = (month: number, year: number | undefined): number =>
  month === FEBRUARY && year !== undefined && !isLeapYear(year) ? LEAP_DAY - 1 : (DAYS_IN_MONTH[month - 1] ?? LONGEST_MONTH);

const problemOf = (month: number, day: number, year: number | undefined, strict: boolean): ImpossibleDate["reason"] | undefined => {
  if (month < 1 || month > MONTHS_IN_YEAR) return strict ? "month" : undefined;
  if (day < 1 || day > LONGEST_MONTH) return strict ? "day" : undefined;
  if (day <= daysIn(month, year)) return undefined;
  return month === FEBRUARY && day === LEAP_DAY ? "leap" : "day";
};

const shapesOf = (words: CalendarWords): Shape[] => {
  const [yearUnit, monthUnit, dayUnit] = words.units.map(escapeRegExp);
  const names = words.months.map(escapeRegExp).join("|");
  const eras = words.eras.map(escapeRegExp).join("|");
  const era = eras === "" ? "" : `(?:(?<era>${eras})\\s?)?`;
  const unitShape =
    yearUnit === undefined || monthUnit === undefined || dayUnit === undefined
      ? []
      : [
          {
            pattern: new RegExp(
              `(?<!${DIGIT})${era}(?:(?<y>${DIGIT}{1,4}|元)${yearUnit}\\s?)?(?<m>${DIGIT}{1,2})${monthUnit}\\s?(?<d>${DIGIT}{1,2})${dayUnit}`,
              "gu",
            ),
            strict: true,
          },
        ];
  const nameShapes =
    names === ""
      ? []
      : [
          { pattern: new RegExp(`\\b(?<name>${names})\\.?\\s(?<d>\\d{1,2})(?:st|nd|rd|th)?(?![\\d:])(?:,?\\s(?<y>\\d{4})\\b)?`, "gu"), strict: false },
          { pattern: new RegExp(`(?<![\\d.,])\\b(?<d>\\d{1,2})(?:st|nd|rd|th)?\\s(?<name>${names})\\b\\.?(?:,?\\s(?<y>\\d{4})\\b)?`, "gu"), strict: false },
        ];
  return [
    { pattern: new RegExp(`${NOT_AFTER_NUMBER}(?<y>\\d{4})-(?<m>\\d{1,2})-(?<d>\\d{1,2})${NOT_BEFORE_NUMBER}`, "gu"), strict: false },
    { pattern: new RegExp(`${NOT_AFTER_NUMBER}(?<y>\\d{4})[/／](?<m>\\d{1,2})[/／](?<d>\\d{1,2})${NOT_BEFORE_NUMBER}`, "gu"), strict: false },
    ...unitShape,
    ...nameShapes,
  ];
};

const impossibleIn = (text: string, shape: Shape, months: readonly string[]): ImpossibleDate[] =>
  [...text.matchAll(shape.pattern)].flatMap((match) => {
    const groups = match.groups ?? {};
    const month = monthOf(groups, months);
    const year = yearOf(groups);
    const reason = problemOf(month, Number(halfWidth(groups["d"] ?? "")), year, shape.strict);
    if (reason === undefined) return [];
    return [{ offset: match.index, written: match[0].trim(), reason, month, days: daysIn(month, year) }];
  });

/** 文字列の中の、暦に無い日付。同じ所に二つの形が当たれば、先に見つけたほうだけ。 */
export const impossibleDates = (text: string, words: CalendarWords): ImpossibleDate[] => {
  const byOffset = new Map<number, ImpossibleDate>();
  shapesOf(words)
    .flatMap((shape) => impossibleIn(text, shape, words.months))
    .forEach((found) => {
      if (!byOffset.has(found.offset)) byOffset.set(found.offset, found);
    });
  return [...byOffset.values()].toSorted((left, right) => left.offset - right.offset);
};

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

export const calendarWordsOf = (doc: ProseDocument): CalendarWords => ({
  months: patternsOf(doc, "month-name"),
  units: patternsOf(doc, "date-time-unit").slice(0, 3),
  eras: patternsOf(doc, "calendar-era"),
});

/** 二つの暦で書いた年の、括弧の外と中が違うもの。二つの年は言語パッケージが日付の木に読んでおく。木は表と引用も読むので、本文に見える日付だけ。 */
const yearsFindings = (doc: ProseDocument, text: string): Finding[] =>
  doc.structure === undefined
    ? []
    : yearDisagreements(doc.structure)
        .filter((found) => text.slice(found.offset, found.end) === doc.source.slice(found.offset, found.end))
        .map((found) => ({
          rule: "",
          severity: "warning",
          line: 0,
          column: 0,
          quote: quoteAround(text, found.offset, found.end),
          values: { written: doc.source.slice(found.offset, found.end), year: found.year, glossYear: found.glossYear, offset: found.offset },
          variant: "years",
        }));

const calendarFindings = (text: string, doc: ProseDocument): Finding[] =>
  impossibleDates(text, calendarWordsOf(doc)).map((found) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, found.offset, found.offset + found.written.length),
    values: { written: found.written, month: found.month, days: found.days, offset: found.offset },
    variant: found.reason,
  }));

export const impossibleDate: Detector = (doc): Finding[] => {
  const text = doc.prose ?? doc.source;
  return [...calendarFindings(text, doc), ...yearsFindings(doc, text)].toSorted(
    (left, right) => Number(left.values["offset"]) - Number(right.values["offset"]),
  );
};
