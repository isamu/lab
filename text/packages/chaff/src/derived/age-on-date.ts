import type { Span } from "../plugin.ts";
import { calendarDateOf } from "./date-arithmetic.ts";

/**
 * 生年月日のラベルの付いた日付と同じ行の年齢（「生年月日：1978年4月12日（受診時 48歳）」）を、ラベルの付いた日（受診日、報告日、
 * Examination date）の満年齢と比べる。年齢の印（受診時）があれば、その印と同じ group のラベルの日で数える。
 * 数える日が決まらない（無い、同じ group に違う日が二つ、日によって満年齢が変わる）ときは何も言わない。
 */
export type LabelWord = { readonly pattern: string; readonly position?: "before" | "after" | undefined; readonly group?: string | undefined };

export type Age = Span & { readonly amount: number; readonly approximate: boolean };

/** The span is the date of birth; birth is its value (1978-04-12). */
export type LabelledBirth = Span & { readonly birth: string; readonly age: Age; readonly group: string | undefined };

export type LabelledReference = Span & { readonly date: string; readonly group: string };

export type AgeVerdict = { readonly birth: LabelledBirth; readonly reference: LabelledReference; readonly expected: number };

const FEBRUARY = 2;
const LEAP_DAY = 29;
const LEAP_DAY_EVE = 28;
const LEAP_CYCLE = 4;
const CENTURY = 100;
const LEAP_CENTURY = 400;

const isLeapYear = (year: number): boolean => (year % LEAP_CYCLE === 0 && year % CENTURY !== 0) || year % LEAP_CENTURY === 0;

/**
 * 満年齢。誕生日の前日までは一つ少ない。2月29日生まれの、うるう年でない年の2月28日は、法と慣習で数え方が分かれるので undefined。
 * 年の無い日付、生まれる前の日も undefined。
 */
export const ageOn = (birthValue: string, onValue: string): number | undefined => {
  const birth = calendarDateOf(birthValue);
  const on = calendarDateOf(onValue);
  if (birth?.year === undefined || on?.year === undefined) return undefined;
  const leapDayEve = birth.month === FEBRUARY && birth.day === LEAP_DAY && on.month === FEBRUARY && on.day === LEAP_DAY_EVE && !isLeapYear(on.year);
  if (leapDayEve) return undefined;
  const reached = on.month > birth.month || (on.month === birth.month && on.day >= birth.day);
  const age = on.year - birth.year - (reached ? 0 : 1);
  return age < 0 ? undefined : age;
};

/** 年齢の印（受診時）が名指す group のラベルの日。その group の日が無ければ、ラベルの付いた日すべて。 */
const candidatesFor = (birth: LabelledBirth, references: readonly LabelledReference[]): readonly LabelledReference[] => {
  const named = references.filter((reference) => reference.group === birth.group);
  return named.length > 0 ? named : references;
};

/** 同じ group に違う日が二つあれば（受診日が二つ）、どちらの日の年齢か決まらない。 */
const hasConflictingGroup = (candidates: readonly LabelledReference[]): boolean =>
  candidates.some((left) => candidates.some((right) => left.group === right.group && left.date !== right.date));

const verdictOf = (birth: LabelledBirth, references: readonly LabelledReference[]): AgeVerdict[] => {
  const candidates = candidatesFor(birth, references);
  const [first] = candidates;
  if (birth.age.approximate || first === undefined || hasConflictingGroup(candidates)) return [];
  const ages = candidates.map((reference) => ageOn(birth.birth, reference.date));
  const expected = ages[0];
  if (expected === undefined || ages.some((age) => age !== expected)) return [];
  return [{ birth, reference: first, expected }];
};

/** 数える日が一つに決まった年齢と、その日の満年齢。書いた年齢と合うものも含む。 */
export const ageVerdicts = (births: readonly LabelledBirth[], references: readonly LabelledReference[]): AgeVerdict[] =>
  births.flatMap((birth) => verdictOf(birth, references));

export const ageMismatches = (births: readonly LabelledBirth[], references: readonly LabelledReference[]): AgeVerdict[] =>
  ageVerdicts(births, references).filter((verdict) => verdict.birth.age.amount !== verdict.expected);

const WORD_CHAR = /[\p{L}\p{N}]/u;
const SEPARATOR = /[\s:：|*＊]/u;

const withoutTrailingSeparators = (text: string): string => {
  let end = text.length;
  while (end > 0 && SEPARATOR.test(text.charAt(end - 1))) end -= 1;
  return text.slice(0, end);
};

const isWordAt = (text: string, at: number): boolean => WORD_CHAR.test(text.charAt(at));

/** text の終わりに、語の切れ目から書いた word。 */
const endsWithWord = (text: string, word: string): boolean => text.endsWith(word) && !isWordAt(text, text.length - word.length - 1);

/** text の頭に書いた word。英字の語は、後ろが語の切れ目のときだけ。 */
const startsWithWord = (text: string, word: string): boolean => text.startsWith(word) && (!/[a-z]$/u.test(word) || !isWordAt(text, word.length));

const before = (word: LabelWord): boolean => (word.position ?? "before") === "before";

/** ラベルの前に書いてよいもの: 行の頭、表の区切り、強調や箇条書きの印、括弧や読点。「前回受診日」「Previous examination date」は別の日。 */
const FIELD_START = /(?:^|[|*＊#>\-・•(（)）、,;；。.])$/u;

/** text の終わりに書いた年齢（「(age 23」の後ろの as of は、その年齢を数える日の印）。 */
const endsWithAge = (text: string, words: AgeWords | undefined): boolean => words !== undefined && agesIn(text, words).some((age) => age.end === text.length);

/** 日付の前（同じ行の、日付までの文字）の終わりに、区切り（：、|、**）を除いて書いたラベル。ラベルは欄の頭から、または words の年齢のすぐ後ろに書いたものだけ。 */
export const labelBefore = (lineBefore: string, labels: readonly LabelWord[], words?: AgeWords): LabelWord | undefined => {
  const head = withoutTrailingSeparators(lineBefore).toLowerCase();
  return labels.filter(before).find((label) => {
    const pattern = label.pattern.toLowerCase();
    if (!head.endsWith(pattern)) return false;
    const lead = head.slice(0, head.length - pattern.length).trimEnd();
    return FIELD_START.test(lead) || endsWithAge(lead, words);
  });
};

/** 日付のすぐ後ろに書いたラベル（2026年4月1日時点）。 */
export const labelAfter = (lineAfter: string, labels: readonly LabelWord[]): LabelWord | undefined => {
  const tail = lineAfter.trimStart().toLowerCase();
  return labels.filter((label) => !before(label)).find((label) => startsWithWord(tail, label.pattern.toLowerCase()));
};

/** 年齢の書き方。before は数の前の語（age、aged）、after は数の後ろの語（歳、old）、skip は数と after のあいだに書いてよい語（years）。 */
export type AgeWords = {
  readonly before: readonly string[];
  readonly after: readonly string[];
  readonly skip: readonly string[];
  readonly approximateBefore: readonly string[];
  readonly approximateAfter: readonly string[];
};

/** 年齢の幅（59-60歳、59〜60 years old）の片方は、書いた年齢ではない。 */
const RANGE_BEFORE = /[0-9０-９]\s*(?:[-–—~〜～]|\sto)$/iu;
const RANGE_AFTER = /^\s*(?:[-–—~〜～]|to\s)\s*[0-9０-９]/iu;

const AGE_NUMBER = /(?<![0-9０-９]|[0-9０-９][.,．，])[0-9０-９]{1,3}(?![0-9０-９]|[.,．，][0-9０-９])/gu;

const longestStart = (text: string, words: readonly string[]): string | undefined =>
  words
    .filter((word) => startsWithWord(text, word.toLowerCase()))
    .toSorted((left, right) => right.length - left.length)
    .at(0);

/** 数の後ろ: 書いてよい語（years）を飛ばしてから、年齢の語（歳、old）があれば、その語の後ろの文字。無ければ undefined。 */
const restAfterMarker = (afterNumber: string, words: AgeWords): string | undefined => {
  const trimmed = afterNumber.trimStart().toLowerCase();
  const skipped = longestStart(trimmed, words.skip);
  const rest = skipped === undefined ? trimmed : trimmed.slice(skipped.length).trimStart();
  const marker = longestStart(rest, words.after);
  return marker === undefined ? undefined : rest.slice(marker.length);
};

/** 一行の中の年齢と、後ろに書いた年齢の語まで（48歳、満48歳、age 57、aged 57、57 years old）。目安の年齢（約48歳、48歳前後）と年齢の幅（59-60歳）は approximate。 */
export const agesIn = (text: string, words: AgeWords): Age[] =>
  [...text.matchAll(AGE_NUMBER)].flatMap((match): Age[] => {
    const start = match.index;
    const end = start + match[0].length;
    const head = text.slice(0, start).trimEnd().toLowerCase();
    const afterNumber = text.slice(end);
    const rest = restAfterMarker(afterNumber, words);
    const marker = words.before.find((word) => endsWithWord(head, word.toLowerCase()));
    if (rest === undefined && marker === undefined) return [];
    const headBeforeMarker = marker === undefined ? head : head.slice(0, head.length - marker.length).trimEnd();
    const approximate =
      RANGE_BEFORE.test(headBeforeMarker) ||
      RANGE_AFTER.test(afterNumber) ||
      words.approximateBefore.some((word) => headBeforeMarker.endsWith(word.toLowerCase())) ||
      (rest !== undefined && words.approximateAfter.some((word) => rest.trimStart().startsWith(word.toLowerCase())));
    const markerEnd = rest === undefined ? end : end + afterNumber.length - rest.length;
    return [{ start, end: markerEnd, amount: Number(match[0].normalize("NFKC")), approximate }];
  });
