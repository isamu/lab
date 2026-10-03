import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { quoteAround } from "./quote-around.ts";

// 時計に無い時刻（午後13時、13 PM、10:75、9時75分）。午前・午後が付けば時は 12 まで、分と秒は 59 まで。
// 午前・午後の語とその置き場所は語彙表 clock-meridiem、時・分・秒の単位は date-time-unit（大きい順の四つ目から）が言う。
// 午前・午後の無い「25:00」は、深夜の番組表のように 24 を超えて数える書き方があるので言わない。

/** 時刻を読むのに要る語。before は時刻の前に書く午前・午後、after は後ろに書く AM・PM、units は時・分・秒の単位。 */
export type ClockWords = { readonly before: readonly string[]; readonly after: readonly string[]; readonly units: readonly string[] };

/** 時計に無い時刻 1 つ。reason は、午前・午後の付いた時が 12 を超える（hour）か、分か秒が 59 を超える（minute）か。 */
export type ImpossibleTime = { readonly offset: number; readonly written: string; readonly reason: "hour" | "minute" };

const DIGIT = "[0-9０-９]";
const COLON = "[:：]";
/** 数の前後に来ない字。英字の語や番号の中（abc10:75、v10:75）は時刻ではない。日本語の字のすぐ後ろ（会議は10:75）は読む。 */
const NOT_AFTER_CLOCK = "(?<![A-Za-z0-9０-９_:：.])";
const NOT_BEFORE_CLOCK = "(?![A-Za-z0-9０-９_:：])";
const HALF_DAY = 12;
const MINUTES_IN_HOUR = 60;
/** 午前・午後の付いた時で、時刻の書き損じと読む上限。50 pm（ピコメートル）のような量を時刻と読まない。 */
const HOURS_IN_DAY = 24;
const FULLWIDTH_OFFSET = 0xfee0;

const halfWidth = (text: string): string => text.replace(/[０-９]/gu, (char) => String.fromCharCode(char.charCodeAt(0) - FULLWIDTH_OFFSET));

type Groups = Readonly<Record<string, string | undefined>>;

const numberIn = (groups: Groups, name: string): number | undefined => {
  const written = groups[name];
  return written === undefined ? undefined : Number(halfWidth(written));
};

/** 分か秒が 59 を超えるか。 */
const isPastMinute = (groups: Groups): boolean =>
  ["m", "colonMinute", "s"].some((name) => {
    const value = numberIn(groups, name);
    return value !== undefined && value >= MINUTES_IN_HOUR;
  });

/** 午前・午後の付いた時が 12 を超えるか（24 まで）。 */
const isPastHalfDay = (groups: Groups): boolean => {
  const hour = numberIn(groups, "h") ?? 0;
  return hour > HALF_DAY && hour <= HOURS_IN_DAY;
};

/** 時刻の書き方と、その中の書き損じの見分け方。 */
type Shape = { readonly pattern: RegExp; readonly problem: (groups: Groups, text: string, at: number) => ImpossibleTime["reason"] | undefined };

const withMeridiem = (groups: Groups): ImpossibleTime["reason"] | undefined => {
  if (isPastHalfDay(groups)) return "hour";
  return isPastMinute(groups) ? "minute" : undefined;
};

const minutesOnly = (groups: Groups): ImpossibleTime["reason"] | undefined => (isPastMinute(groups) ? "minute" : undefined);

/** 「Genesis 24:67」「Science, 12:75」のような章と節、巻と頁は時刻ではない。頭が大文字の語や区切りの印のすぐ後ろは読まない。 */
const isCitationBefore = (before: string): boolean => {
  const trimmed = before.trimEnd();
  if ([",", ";", "."].includes(trimmed.slice(-1))) return true;
  const lastWord = trimmed.split(/\s/u).at(-1) ?? "";
  return /^\p{Lu}/u.test(lastWord);
};

/** 時を 2 以上か 0 埋め（09:75）で書いた、時と分だけの時刻。1:75 は縮尺や比。 */
const bareClock = (groups: Groups, text: string, at: number): ImpossibleTime["reason"] | undefined => {
  const hourText = groups["h"] ?? "";
  const hour = Number(halfWidth(hourText));
  const looksLikeClock = hour <= HOURS_IN_DAY && (hour >= 2 || /^[0０]/u.test(hourText));
  if (!looksLikeClock || isCitationBefore(text.slice(Math.max(0, at - HALF_DAY), at))) return undefined;
  return minutesOnly(groups);
};

const alternation = (words: readonly string[]): string => words.map(escapeRegExp).join("|");

const meridiemShapes = (words: ClockWords): Shape[] => {
  const [hourUnit, minuteUnit] = words.units.map(escapeRegExp);
  const before = alternation(words.before);
  const after = alternation(words.after);
  const minuteTail = minuteUnit === undefined ? "" : `(?:\\s?(?<m>${DIGIT}{1,2})${minuteUnit})?`;
  const unitTail = hourUnit === undefined ? "" : `${hourUnit}${minuteTail}|`;
  return [
    ...(after === ""
      ? []
      : [
          {
            pattern: new RegExp(`${NOT_AFTER_CLOCK}(?<![,])(?<h>${DIGIT}{1,2})(?:${COLON}(?<m>${DIGIT}{2}))?\\s?(?:${after})(?![\\p{L}\\p{N}])`, "gu"),
            problem: withMeridiem,
          },
        ]),
    ...(before === ""
      ? []
      : [{ pattern: new RegExp(`(?:${before})\\s?(?<h>${DIGIT}{1,2})(?:${unitTail}[:：](?<colonMinute>${DIGIT}{2}))`, "gu"), problem: withMeridiem }]),
  ];
};

const unitShapes = (words: ClockWords): Shape[] => {
  const [hourUnit, minuteUnit, secondUnit] = words.units.map(escapeRegExp);
  if (hourUnit === undefined || minuteUnit === undefined) return [];
  const seconds = secondUnit === undefined ? "" : `(?:\\s?(?<s>${DIGIT}{1,2})${secondUnit})?`;
  return [{ pattern: new RegExp(`(?<!${DIGIT})(?<h>${DIGIT}{1,2})${hourUnit}\\s?(?<m>${DIGIT}{1,2})${minuteUnit}${seconds}`, "gu"), problem: minutesOnly }];
};

const shapesOf = (words: ClockWords): Shape[] => [
  ...meridiemShapes(words),
  ...unitShapes(words),
  {
    pattern: new RegExp(`${NOT_AFTER_CLOCK}(?<h>${DIGIT}{1,3})${COLON}(?<m>${DIGIT}{2})${COLON}(?<s>${DIGIT}{2})${NOT_BEFORE_CLOCK}`, "gu"),
    problem: minutesOnly,
  },
  { pattern: new RegExp(`${NOT_AFTER_CLOCK}(?<![,/])(?<h>${DIGIT}{1,2})${COLON}(?<m>${DIGIT}{2})${NOT_BEFORE_CLOCK}`, "gu"), problem: bareClock },
];

const impossibleIn = (text: string, shape: Shape): ImpossibleTime[] =>
  [...text.matchAll(shape.pattern)].flatMap((match) => {
    const reason = shape.problem(match.groups ?? {}, text, match.index);
    return reason === undefined ? [] : [{ offset: match.index, written: match[0].trim(), reason }];
  });

const overlaps = (left: ImpossibleTime, right: ImpossibleTime): boolean =>
  left.offset < right.offset + right.written.length && right.offset < left.offset + left.written.length;

/** 文字列の中の、時計に無い時刻。重なる所に二つの形が当たれば、先の形（午前・午後の付いたもの）だけ。 */
export const impossibleTimes = (text: string, words: ClockWords): ImpossibleTime[] =>
  shapesOf(words)
    .flatMap((shape) => impossibleIn(text, shape))
    .reduce<ImpossibleTime[]>((kept, found) => (kept.some((earlier) => overlaps(earlier, found)) ? kept : [...kept, found]), [])
    .toSorted((left, right) => left.offset - right.offset);

const meridiemOf = (doc: ProseDocument, position: "before" | "after"): string[] =>
  (doc.lexicons["clock-meridiem"] ?? []).filter((entry) => entry.position === position).map((entry) => entry.pattern);

export const clockWordsOf = (doc: ProseDocument): ClockWords => ({
  before: meridiemOf(doc, "before"),
  after: meridiemOf(doc, "after"),
  units: (doc.lexicons["date-time-unit"] ?? []).map((entry) => entry.pattern).slice(3),
});

export const impossibleTime: Detector = (doc): Finding[] => {
  const text = doc.prose ?? doc.source;
  return impossibleTimes(text, clockWordsOf(doc)).map((found) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, found.offset, found.offset + found.written.length),
    values: { written: found.written, offset: found.offset },
    variant: found.reason,
  }));
};
