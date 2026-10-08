import type { Span } from "../plugin.ts";
import { bySentence } from "./sentence-buckets.ts";
import { calendarDateOf, dateOf, shifted } from "./date-arithmetic.ts";
import type { DatedValue } from "./durations.ts";
import { cellsOf, tablesOf, type Cell } from "../facts/table-facts.ts";
import { linesOf } from "../structure/lines.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";

/**
 * 泊数。チェックインからチェックアウトまでの泊数は、二つの日付の差の日数（10月12日から10月14日までは2泊）。
 * 一つの文に日付がちょうど二つと泊数がちょうど一つあるときと、チェックイン・チェックアウト・泊数の列がそろった表の行で比べる。
 * 「2泊3日」のように泊数と日数を並べたものは、日数が泊数より一つ多いかを見る。Pure.
 */
export type Count = Span & { readonly amount: number };

export type NightsMismatch = { readonly start: DatedValue; readonly end: DatedValue; readonly nights: Span; readonly expected: number };

export type NightsDaysMismatch = { readonly nights: Count; readonly days: Count; readonly expected: number };

export type StayColumnWords = {
  readonly checkIn: readonly string[];
  readonly checkOut: readonly string[];
  readonly nights: readonly string[];
  /** The words of a nights unit (泊, nights) a nights cell may write after its number. */
  readonly units: readonly string[];
};

const DAY_MS = 86_400_000;

type Between = { start: DatedValue; end: DatedValue; nights: number };

const daysFrom = (from: Date, to: Date): number => Math.round((to.getTime() - from.getTime()) / DAY_MS);

/** 月日だけの二つの日付は、近いほうの向き（12月30日と1月2日は年をまたいで3泊、10月14日と10月12日は2泊）。 */
const nearerWay = (first: DatedValue, second: DatedValue, firstDay: Date, secondDay: Date): Between => {
  const forward = daysFrom(firstDay, secondDay);
  const ahead = forward < 0 ? daysFrom(firstDay, shifted(secondDay, 1, "year")) : forward;
  const back = -forward < 0 ? daysFrom(secondDay, shifted(firstDay, 1, "year")) : -forward;
  return back < ahead ? { start: second, end: first, nights: back } : { start: first, end: second, nights: ahead };
};

/** 二つの日付の間の泊数。年まで書いたら早いほうから。年の有る日付と無い日付の組は読まない。 */
const nightsBetween = (first: DatedValue, second: DatedValue): Between | undefined => {
  const [firstDate, secondDate] = [calendarDateOf(first.value), calendarDateOf(second.value)];
  if (firstDate === undefined || secondDate === undefined || (firstDate.year === undefined) !== (secondDate.year === undefined)) return undefined;
  const [firstDay, secondDay] = [dateOf(firstDate), dateOf(secondDate)];
  if (firstDate.year === undefined) return nearerWay(first, second, firstDay, secondDay);
  const forward = daysFrom(firstDay, secondDay);
  return forward < 0 ? { start: second, end: first, nights: -forward } : { start: first, end: second, nights: forward };
};

const mismatchOf = (first: DatedValue, second: DatedValue, nights: Count): NightsMismatch | undefined => {
  const between = nightsBetween(first, second);
  if (between === undefined || between.nights <= 0 || between.nights === nights.amount) return undefined;
  return { start: between.start, end: between.end, nights, expected: between.nights };
};

/** 一つの文の中の、二つの日付と泊数。 */
export const stayNightsMismatches = (sentences: readonly Span[], dates: readonly DatedValue[], nights: readonly Count[]): NightsMismatch[] => {
  const datesIn = bySentence(sentences, dates);
  return [...bySentence(sentences, nights).entries()].flatMap(([index, inNights]) => {
    const inDates = datesIn.get(index) ?? [];
    const [first, second] = inDates;
    const [count] = inNights;
    if (inDates.length !== 2 || inNights.length !== 1 || first === undefined || second === undefined || count === undefined) return [];
    const mismatch = mismatchOf(first, second, count);
    return mismatch === undefined ? [] : [mismatch];
  });
};

const normalizedGap = (text: string): string => text.normalize("NFKC").trim().toLowerCase().replace(/\s+/gu, " ");

const joined = (source: string, left: Span, right: Span, joiners: readonly string[]): boolean => {
  if (right.start < left.end) return false;
  const gap = normalizedGap(source.slice(left.end, right.start));
  return gap === "" || joiners.some((joiner) => normalizedGap(joiner) === gap);
};

/** 泊数と日数を並べたもの（2泊3日、2 days, 1 night）。泊数の直前か直後に、つなぎの語だけを挟んで日数がある。 */
export const nightsDaysPairs = (
  source: string,
  nights: readonly Count[],
  days: readonly Count[],
  joiners: readonly string[],
): { nights: Count; days: Count }[] =>
  nights.flatMap((count) => {
    const paired = days.find((day) => joined(source, count, day, joiners) || joined(source, day, count, joiners));
    return paired === undefined ? [] : [{ nights: count, days: paired }];
  });

/** 日数が泊数より一つ多くない組。 */
export const nightsDaysMismatches = (pairs: readonly { nights: Count; days: Count }[]): NightsDaysMismatch[] =>
  pairs.flatMap((pair) => (pair.days.amount === pair.nights.amount + 1 ? [] : [{ ...pair, expected: pair.nights.amount + 1 }]));

const keyOf = (text: string): string => withoutEdgeMarks(text).normalize("NFKC").toLowerCase().replace(/\s+/gu, " ");

const columnOf = (header: readonly Cell[], names: readonly string[]): number => {
  const wanted = new Set(names.map(keyOf));
  return header.findIndex((cell) => wanted.has(keyOf(cell.text)));
};

const LEADING_DIGITS = /^\d+/u;

/** 泊数の升の数（「2」「2泊」「2 nights」）。それ以外を書いた升は読まない。 */
const nightsInCell = (cell: Cell, units: readonly string[]): Count | undefined => {
  const key = keyOf(cell.text);
  const digits = LEADING_DIGITS.exec(key)?.[0];
  if (digits === undefined) return undefined;
  const rest = key.slice(digits.length).trim();
  if (rest !== "" && !units.some((unit) => keyOf(unit) === rest)) return undefined;
  const offset = cell.text.length - cell.text.trimStart().length;
  return { start: cell.start + offset, end: cell.end, amount: Number(digits) };
};

const onlyDateIn = (cell: Cell | undefined, dates: readonly DatedValue[]): DatedValue | undefined => {
  if (cell === undefined) return undefined;
  const inside = dates.filter((date) => date.start >= cell.start && date.end <= cell.end);
  return inside.length === 1 ? inside[0] : undefined;
};

type StayColumns = { readonly checkIn: number; readonly checkOut: number; readonly nights: number };

const rowMismatch = (cells: readonly Cell[], columns: StayColumns, dates: readonly DatedValue[], units: readonly string[]): NightsMismatch | undefined => {
  const checkIn = onlyDateIn(cells[columns.checkIn], dates);
  const checkOut = onlyDateIn(cells[columns.checkOut], dates);
  const nightsCell = cells[columns.nights];
  const nights = nightsCell === undefined ? undefined : nightsInCell(nightsCell, units);
  return checkIn === undefined || checkOut === undefined || nights === undefined ? undefined : mismatchOf(checkIn, checkOut, nights);
};

/** チェックイン・チェックアウト・泊数の列がある表の、行ごとの泊数。 */
export const tableNightsMismatches = (source: string, dates: readonly DatedValue[], words: StayColumnWords): NightsMismatch[] =>
  tablesOf(linesOf(source)).flatMap(({ header, rows }) => {
    const headerCells = cellsOf(header);
    const columns = {
      checkIn: columnOf(headerCells, words.checkIn),
      checkOut: columnOf(headerCells, words.checkOut),
      nights: columnOf(headerCells, words.nights),
    };
    if (Object.values(columns).some((index) => index < 0)) return [];
    return rows.flatMap((row) => {
      const mismatch = rowMismatch(cellsOf(row), columns, dates, words.units);
      return mismatch === undefined ? [] : [mismatch];
    });
  });
