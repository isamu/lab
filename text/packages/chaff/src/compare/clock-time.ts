import type { Span } from "../plugin.ts";
import { overlapsAny, spanIndex } from "./spans.ts";

/** A time of day and where it is written. key is "HH:MM" on a 24-hour clock, with ":SS" when seconds are given. */
export type ClockTime = Span & { readonly key: string };

const DIGIT = "[0-9０-９]";
const COLON = "[:：]";

/** 10:30, 15:30:05, 3:30 p.m. */
const COLON_TIME = new RegExp(
  `(?<![0-9０-９])(${DIGIT}{1,2})${COLON}(${DIGIT}{2})(?:${COLON}(${DIGIT}{2}))?(?:\\s?([ap])\\.?m\\.?(?![a-z]))?(?![0-9０-９])`,
  "giu",
);

/** 3 p.m., 11am. */
const MERIDIEM_TIME = new RegExp(`(?<![0-9０-９:：])(${DIGIT}{1,2})\\s?([ap])\\.?m\\.?(?![a-z])`, "giu");

/** 午後3時30分, 10時半, 9時. */
const JAPANESE_TIME = new RegExp(`(午前|午後)?(${DIGIT}{1,2})時(?:(${DIGIT}{1,2})分|(半))?`, "gu");

const LAST_HOUR = 24;
const MINUTES_PER_HOUR = 60;
const HALF_HOUR = 30;
const NOON = 12;
const PADDED = 2;

type Reading = { readonly hour: number; readonly minute: number; readonly second?: number | undefined; readonly afternoon?: boolean | undefined };

const hourOf = (hour: number, afternoon: boolean | undefined): number => {
  if (afternoon === undefined) return hour;
  if (afternoon) return hour < NOON ? hour + NOON : hour;
  return hour === NOON ? 0 : hour;
};

const padded = (value: number): string => String(value).padStart(PADDED, "0");

/** Whether the hour is one on its clock: up to 12 with a.m. or p.m., else up to 23, and 24 only as 24:00. */
const isHour = ({ hour, minute, second, afternoon }: Reading): boolean => {
  if (afternoon !== undefined) return hour <= NOON;
  return hour < LAST_HOUR || (hour === LAST_HOUR && minute === 0 && (second ?? 0) === 0);
};

/** The key, or undefined when the numbers are not a time of day (24:30, 13 p.m., 3:75). */
const keyOf = (reading: Reading): string | undefined => {
  const { hour, minute, second } = reading;
  if (!isHour(reading) || minute >= MINUTES_PER_HOUR || (second ?? 0) >= MINUTES_PER_HOUR) return undefined;
  const parts = [hourOf(hour, reading.afternoon), minute, ...(second === undefined ? [] : [second])];
  return parts.map(padded).join(":");
};

const numberOf = (digits: string | undefined): number | undefined => (digits === undefined ? undefined : Number(digits.normalize("NFKC")));

const meridiem = (letter: string | undefined): boolean | undefined => (letter === undefined ? undefined : letter.toLowerCase() === "p");

const japaneseMeridiem = (word: string | undefined): boolean | undefined => (word === undefined ? undefined : word === "午後");

type Reader = { readonly pattern: RegExp; readonly read: (match: RegExpMatchArray) => Reading };

const READERS: readonly Reader[] = [
  {
    pattern: JAPANESE_TIME,
    read: (match) => ({
      hour: numberOf(match[2]) ?? 0,
      minute: match[4] === undefined ? (numberOf(match[3]) ?? 0) : HALF_HOUR,
      afternoon: japaneseMeridiem(match[1]),
    }),
  },
  {
    pattern: COLON_TIME,
    read: (match) => ({ hour: numberOf(match[1]) ?? 0, minute: numberOf(match[2]) ?? 0, second: numberOf(match[3]), afternoon: meridiem(match[4]) }),
  },
  { pattern: MERIDIEM_TIME, read: (match) => ({ hour: numberOf(match[1]) ?? 0, minute: 0, afternoon: meridiem(match[2]) }) },
];

/** Times of day in text, in the order written. Where two readings overlap, the earlier reader in READERS wins. */
export const clockTimes = (text: string): ClockTime[] =>
  READERS.reduce<ClockTime[]>((found, reader) => {
    const taken = spanIndex(found);
    const fresh = [...text.matchAll(reader.pattern)].flatMap((match) => {
      const key = keyOf(reader.read(match));
      const span = { start: match.index, end: match.index + match[0].length };
      return key === undefined || overlapsAny(taken, span) ? [] : [{ ...span, key }];
    });
    return [...found, ...fresh];
  }, []).toSorted((left, right) => left.start - right.start);
