// 日付の書き方（2026-10-02、2026年10月2日、Oct 2, 2026）を読む。純粋な関数だけを置く。
// 月の名前と元号は言語パッケージの語彙表が渡す。年・月・日のそろった日付だけを読む（年だけ、月日だけは書き方を比べられない）。

/** 見つけた日付 1 つ。offset は渡した文字列の中の位置、style は書き方の名前。 */
export type WrittenDate = { readonly offset: number; readonly written: string; readonly style: string };

/** 書き方を読むのに要る語。months は月の名前（January、Jan）、eras は元号（令和）。 */
export type DateWords = { readonly months: readonly string[]; readonly eras: readonly string[] };

const DIGIT = "[0-9０-９]";
/** 日付の前に来ない字。URL や版（v1.2.2026.10）の中の数を日付と読まない。 */
const NOT_AFTER = "(?<![\\w/.\\-])";

const escaped = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

type Shape = readonly [string, RegExp];

/** 日付の後ろに来ない字。時刻の付いた日時（2026-10-02T12:00）とファイルの名前（2026-10-02.pdf）は日付の書き方ではない。 */
const NOT_BEFORE = "(?![\\w/／\\-]|\\.\\w)";

const Y = `(?<y>${DIGIT}{4})`;
const M = `(?<m>${DIGIT}{1,2})`;
const D = `(?<d>${DIGIT}{1,2})`;

/** 書き方の名前と、それを読む形。数字の組は月と日の範囲を後で確かめる。全角の数字も読む。 */
const numericShapes = (): Shape[] => [
  ["iso", new RegExp(`${NOT_AFTER}${Y}-${M}-${D}${NOT_BEFORE}`, "gu")],
  ["year-slash", new RegExp(`${NOT_AFTER}${Y}[/／]${M}[/／]${D}${NOT_BEFORE}`, "gu")],
  ["year-dot", new RegExp(`${NOT_AFTER}${Y}\\.${M}\\.${D}(?!\\.?[\\d０-９])`, "gu")],
  ["slash-year-last", new RegExp(`${NOT_AFTER}${M}[/／]${D}[/／]${Y}${NOT_BEFORE}`, "gu")],
  ["nen-gappi", new RegExp(`${Y}年\\s?${M}月\\s?${D}日`, "gu")],
];

const monthShapes = (months: string): Shape[] =>
  months === ""
    ? []
    : [
        ["month-day-year", new RegExp(`\\b(?:${months})\\.?\\s+(?<d>\\d{1,2})(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, "gu")],
        ["day-month-year", new RegExp(`\\b(?<d>\\d{1,2})(?:st|nd|rd|th)?\\s+(?:${months})\\.?,?\\s+\\d{4}\\b`, "gu")],
      ];

const eraShapes = (eras: string): Shape[] => (eras === "" ? [] : [["era", new RegExp(`(?:${eras})\\s?(?:${DIGIT}{1,2}|元)年\\s?${M}月\\s?${D}日`, "gu")]]);

/** 語彙表の語を使う形。月の名前は書いたとおりに照らす（小文字の may は月ではない）。 */
const namedShapes = (words: DateWords): Shape[] => [...monthShapes(words.months.map(escaped).join("|")), ...eraShapes(words.eras.map(escaped).join("|"))];

const FULLWIDTH_OFFSET = 0xfee0;
const halfWidth = (text: string): string => text.replace(/[０-９]/gu, (char) => String.fromCharCode(char.charCodeAt(0) - FULLWIDTH_OFFSET));

const MONTHS_IN_YEAR = 12;
const PERCENT = 100;
const DAYS_IN_MONTH = 31;

type Groups = Readonly<Record<string, string | undefined>> | undefined;

const numberIn = (groups: Groups, name: string): number => Number(halfWidth(groups?.[name] ?? ""));

const isMonthDay = (month: number, day: number): boolean => month >= 1 && month <= MONTHS_IN_YEAR && day >= 1 && day <= DAYS_IN_MONTH;

/** 数字の組が月と日として読めるか。読めなければ版や番号（2026.10.45）。 */
const isCalendar = (groups: Groups): boolean => isMonthDay(numberIn(groups, "m"), numberIn(groups, "d"));

/** 月の名前で書いた日付の日。月は名前で決まる。 */
const isDay = (groups: Groups): boolean => isMonthDay(1, numberIn(groups, "d"));

/** 年が後ろの数字の組（10/2/2026、25/12/2026）。月日の順は国で違うので、どちらの順でも読めればよい。 */
const isEitherOrder = (groups: Groups): boolean =>
  isMonthDay(numberIn(groups, "m"), numberIn(groups, "d")) || isMonthDay(numberIn(groups, "d"), numberIn(groups, "m"));

/** 書き方ごとの、数が月と日として読めるかの確かめ。 */
const CHECKS: Readonly<Record<string, (groups: Groups) => boolean>> = {
  iso: isCalendar,
  "year-slash": isCalendar,
  "year-dot": isCalendar,
  "nen-gappi": isCalendar,
  "slash-year-last": isEitherOrder,
  era: isCalendar,
  "month-day-year": isDay,
  "day-month-year": isDay,
};

const found = (style: string, pattern: RegExp, text: string): WrittenDate[] => {
  const check = CHECKS[style];
  return [...text.matchAll(pattern)].flatMap((match) => (check?.(match.groups) === true ? [{ offset: match.index, written: match[0], style }] : []));
};

/** 文字列の中の日付と、その書き方。形どうしは同じ所に当たらない（区切りの字と、前後に来ない字が違う）。 */
export const datesIn = (text: string, words: DateWords): WrittenDate[] =>
  [
    ...numericShapes().flatMap(([style, pattern]) => found(style, pattern, text)),
    ...namedShapes(words).flatMap(([style, pattern]) => found(style, pattern, text)),
  ].toSorted((left, right) => left.offset - right.offset);

/** 少ないほうの書き方の日付と、多いほうの書き方の数と例。 */
export type DateMinority = { readonly odd: readonly WrittenDate[]; readonly majority: WrittenDate; readonly count: number; readonly total: number };

/**
 * 書き方の多いほうと、それ以外の日付。ほかの書き方の日付の割合が limit パーセント以下のときだけ。
 * それより多ければ、二つの書き方を使い分けている文書と読む（表は 2026-10-02、本文は 2026年10月2日）。いちばん多い書き方が同じ数で並べば言わない。
 */
export const dateMinority = (dates: readonly WrittenDate[], limit: number): DateMinority | undefined => {
  const counts = new Map<string, number>();
  dates.forEach((date) => counts.set(date.style, (counts.get(date.style) ?? 0) + 1));
  const [top, second] = [...counts].toSorted((left, right) => right[1] - left[1]);
  if (top === undefined || second === undefined || top[1] === second[1]) return undefined;
  const odd = dates.filter((date) => date.style !== top[0]);
  const majority = dates.find((date) => date.style === top[0]);
  if (majority === undefined || odd.length * PERCENT > dates.length * limit) return undefined;
  return { odd, majority, count: top[1], total: dates.length };
};

/** 行の頭から日付までが、箇条書きの印・表の区切り・強調の印と空白だけ。予定表の行の頭の日付（- 2026-10-16: …、| 2026-10-16 |）。 */
const LINE_HEAD = /(?:^|\|)[\s>*_+-]*(?:\d+[.)]\s+)?$/u;

/** 日付が行の頭（箇条書きの項目や表の升の頭）にあるか。 */
export const opensLine = (text: string, offset: number): boolean => LINE_HEAD.test(text.slice(text.lastIndexOf("\n", offset - 1) + 1, offset));

/**
 * 行の頭の日付と、文の中の日付を分ける。予定表を 2026-10-16 で並べ、文では 14 October 2026 と書くのは使い分けで、混ざりではない。
 * 書き方はそれぞれの組の中でだけ比べる。
 */
export const dateGroups = (text: string, dates: readonly WrittenDate[]): WrittenDate[][] =>
  [true, false].map((head) => dates.filter((date) => opensLine(text, date.offset) === head)).filter((group) => group.length > 0);
