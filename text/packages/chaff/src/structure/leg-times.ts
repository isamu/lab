import type { StructureIssue } from "./issues.ts";
import { TABLE_RULE } from "./runs.ts";
import {
  crossesZones,
  dayShiftOf,
  markBefore,
  markRightAfter,
  wordOffsets,
  zonesIn,
  SECONDS_PER_DAY,
  type DateSpan,
  type Mark,
  type TimeSpan,
  type TimeWords,
} from "./time-marks.ts";

/**
 * 一つの行（箇条書きの項目、表の行、文の一行）に書いた発と着の時刻。着が発より前なら、どちらかの書き間違い。
 * 発・着は、時刻のすぐ後ろの印（「08:00発」）か、時刻の少し前の印（「departs Boston 7:30 AM」「dep 10:30」）、
 * または表の列の見出し（出発、到着、Departs、Arrives。語彙表 leg-column）で読む。
 * 着に翌日の印（翌、+1、next day）があれば一日足す。発と着の両方に日付があれば日付で比べ、片方だけなら比べない。
 * 違う時間帯の印が二つある行と、「現地時間」のようにどこの時刻かを言わない印のある行は、時刻をそのまま比べられないので言わない。
 */

/** 発か着の時刻。date はその時刻の前に書いた日付、shift は翌日（1）か前日（-1）の印、zone は時刻の後ろに書いた時間帯（無ければ空）。 */
type LegTime = {
  readonly offset: number;
  readonly end: number;
  readonly written: string;
  readonly seconds: number;
  readonly shift: number;
  readonly date: string | undefined;
  readonly zone: string;
};

type Leg = LegTime & { readonly side: string };

const DEPARTURE = "departure";
const ARRIVAL = "arrival";

/** 「departs Washington Reagan 1:30 PM」のように、発着の語と時刻の間に挟んでよい字の数（地名）。 */
const LEG_WORD_GAP = 32;
/** 発着の語と時刻の間に来れば、その語は時刻にかからない（文や句の切れ目）。 */
const BREAK = /[。．;；!?！？]|\.\s/u;

type Inputs = { readonly source: string; readonly times: readonly TimeSpan[]; readonly dates: readonly DateSpan[]; readonly words: TimeWords };

const timesWithin = (times: readonly TimeSpan[], start: number, end: number): TimeSpan[] => times.filter((time) => time.start >= start && time.end <= end);

/** 時刻の日付と読む、時刻の前に書いた日付までの字の数（「Feb 8, 1:00 PM」「2月8日 13:00」）。 */
const DATE_WINDOW = 4;

/** 時刻の後ろで、その時刻の時間帯の印（17:00 JST）を探す字の数。 */
const ZONE_WINDOW = 12;

/** 時刻を、from から to までの原文（前の時刻の後ろから次の時刻の前まで、表なら升）の中で読む。 */
const legTimeOf = (time: TimeSpan, from: number, to: number, inputs: Inputs): LegTime => {
  const head = inputs.source.slice(from, time.start);
  const date = inputs.dates.filter((span) => span.start >= from && span.end <= time.start && time.start - span.end <= DATE_WINDOW).at(-1)?.value;
  const shift = dayShiftOf(head, inputs.source, time.end, inputs.words);
  const zone = zonesIn(inputs.source.slice(time.end, Math.min(to, time.end + ZONE_WINDOW)), inputs.words)[0]?.text ?? "";
  return { offset: time.start, end: time.end, written: inputs.source.slice(time.start, time.end), seconds: time.seconds, shift, date, zone };
};

/** 時刻の前の語（departs、dep）。間に句の切れ目があれば、その語はこの時刻のものではない。 */
const sideBefore = (head: string, legs: readonly Mark[]): string | undefined => {
  const mark = markBefore(head, legs, LEG_WORD_GAP);
  if (mark === undefined) return undefined;
  const at = Math.max(...wordOffsets(head, mark.pattern));
  return BREAK.test(head.slice(at + mark.pattern.length)) ? undefined : mark.group;
};

/** 一行の中の発着の時刻を、書いた順に。前の時刻から後ろだけを、その時刻の前置きとして読む。 */
const legsInLine = (start: number, end: number, inputs: Inputs): Leg[] =>
  timesWithin(inputs.times, start, end).flatMap((time, index, all) => {
    const from = all[index - 1]?.end ?? start;
    const to = all[index + 1]?.start ?? end;
    const side = markRightAfter(inputs.source, time.end, inputs.words.legs)?.group ?? sideBefore(inputs.source.slice(from, time.start), inputs.words.legs);
    return side === DEPARTURE || side === ARRIVAL ? [{ ...legTimeOf(time, from, to, inputs), side }] : [];
  });

/** 発のあとに来た最初の着を、その発の組にする。間に文の切れ目があれば、着は別の文のもので組にしない。 */
const pairsOf = (source: string, legs: readonly Leg[]): [LegTime, LegTime][] =>
  legs.reduce<{ pending: LegTime | undefined; pairs: [LegTime, LegTime][] }>(
    (found, leg) => {
      if (leg.side === DEPARTURE) return { ...found, pending: leg };
      if (found.pending === undefined || BREAK.test(source.slice(found.pending.end, leg.offset))) return { ...found, pending: undefined };
      return { pending: undefined, pairs: [...found.pairs, [found.pending, leg]] };
    },
    { pending: undefined, pairs: [] },
  ).pairs;

/** 年月日、年月、月日は、同じ書き方どうしでしか比べない。 */
const sameShape = (left: string, right: string): boolean => left.length === right.length;

/**
 * 着が発より前か。両方に日付があれば日付で、日付が同じなら時刻で比べる。片方だけに日付があれば、もう片方の日が分からない。
 * 時間帯の印が発と着で違えば（片方だけに書いたときも）、時刻をそのまま比べられない。
 */
export const arrivesFirst = (departure: LegTime, arrival: LegTime): boolean => {
  if ((departure.date === undefined) !== (arrival.date === undefined) || departure.zone !== arrival.zone) return false;
  if (departure.date !== undefined && arrival.date !== undefined) {
    if (!sameShape(departure.date, arrival.date)) return false;
    if (departure.date !== arrival.date) return arrival.date < departure.date;
  }
  return arrival.shift * SECONDS_PER_DAY + arrival.seconds < departure.shift * SECONDS_PER_DAY + departure.seconds;
};

const issueOf = ([departure, arrival]: [LegTime, LegTime]): StructureIssue => ({
  offset: arrival.offset,
  values: { arrival: arrival.written, departure: departure.written },
});

const linesOf = (source: string): { start: number; end: number }[] =>
  source.split("\n").reduce<{ start: number; end: number }[]>((lines, text) => {
    const start = (lines.at(-1)?.end ?? -1) + 1;
    return [...lines, { start, end: start + text.length }];
  }, []);

/** 行の中で発と着の印から読む組。 */
const inlinePairs = (inputs: Inputs, zonesOf: (start: number, end: number) => boolean): [LegTime, LegTime][] =>
  linesOf(inputs.source).flatMap((line) => (zonesOf(line.start, line.end) ? [] : pairsOf(inputs.source, legsInLine(line.start, line.end, inputs))));

type Cell = { readonly start: number; readonly end: number };

/** 表の一行を、| で区切った升に分ける。先頭と末尾の | の外は升ではない。 */
export const cellsOf = (source: string, start: number, end: number): Cell[] => {
  const text = source.slice(start, end);
  const bars = [...text.matchAll(/(?<!\\)\|/gu)].map((match) => start + match.index);
  const edges = [text.trimStart().startsWith("|") ? undefined : start - 1, ...bars, text.trimEnd().endsWith("|") ? undefined : end].filter(
    (edge) => edge !== undefined,
  );
  return edges.slice(1).map((edge, index) => ({ start: (edges[index] ?? start) + 1, end: edge }));
};

/** 見出しの升の後ろの括弧書き（「出発（現地時間）」「Departs (JST)」）。列の名前はその前まで。 */
const NOTE_OPENER = /[(（[［]/u;

const columnName = (heading: string): string => {
  const note = heading.search(NOTE_OPENER);
  return (note === -1 ? heading : heading.slice(0, note)).trim();
};

/** 見出しの升の名前が、発着の列の名前（語彙表 leg-column）と同じ最初の列。 */
const columnOf = (source: string, header: readonly Cell[], columns: readonly Mark[], side: string): number =>
  header.findIndex((cell) => {
    const name = columnName(source.slice(cell.start, cell.end));
    return columns.some((mark) => mark.group === side && mark.pattern === name);
  });

/** 升の中の最初の時刻を、発か着として読む。 */
const cellTime = (cell: Cell | undefined, inputs: Inputs): LegTime | undefined => {
  if (cell === undefined) return undefined;
  const time = timesWithin(inputs.times, cell.start, cell.end)[0];
  return time === undefined ? undefined : legTimeOf(time, cell.start, cell.end, inputs);
};

type Table = { readonly header: Cell[]; readonly rows: { start: number; end: number }[] };

/** 見出しの行、区切りの行、| のある行が続くあいだを一つの表にする。 */
const tablesOf = (source: string): Table[] => {
  const lines = linesOf(source);
  return lines.flatMap((line, index) => {
    const header = lines[index - 1];
    if (header === undefined || !TABLE_RULE.test(source.slice(line.start, line.end))) return [];
    const after = lines.slice(index + 1);
    const stop = after.findIndex((row) => !source.slice(row.start, row.end).includes("|"));
    return [{ header: cellsOf(source, header.start, header.end), rows: stop === -1 ? after : after.slice(0, stop) }];
  });
};

/** 発の列と着の列を見出しから読む表の組。見出しに時間帯の印があれば、行と合わせて時間帯を見る。 */
const columnPairs = (inputs: Inputs, zonesOf: (start: number, end: number) => boolean): [LegTime, LegTime][] =>
  tablesOf(inputs.source).flatMap((table) => {
    const departs = columnOf(inputs.source, table.header, inputs.words.columns, DEPARTURE);
    const arrives = columnOf(inputs.source, table.header, inputs.words.columns, ARRIVAL);
    const headerLine = { start: table.header[0]?.start ?? 0, end: table.header.at(-1)?.end ?? 0 };
    if (departs === -1 || arrives === -1) return [];
    return table.rows.flatMap((row): [LegTime, LegTime][] => {
      const cells = cellsOf(inputs.source, row.start, row.end);
      const departure = cellTime(cells[departs], inputs);
      const arrival = cellTime(cells[arrives], inputs);
      const zoned = zonesOf(row.start, row.end) || zonesOf(headerLine.start, headerLine.end);
      return departure === undefined || arrival === undefined || zoned ? [] : [[departure, arrival]];
    });
  });

/** 着が発より前の組。同じ着を表の列と行の中の印の両方から読んでも、一度だけ言う。 */
export const arrivalsBeforeDeparture = (source: string, times: readonly TimeSpan[], dates: readonly DateSpan[], words: TimeWords): StructureIssue[] => {
  const inputs = { source, times, dates, words };
  const zonesOf = (start: number, end: number): boolean => crossesZones(zonesIn(source.slice(start, end), words));
  const issues = [...inlinePairs(inputs, zonesOf), ...columnPairs(inputs, zonesOf)]
    .filter(([departure, arrival]) => arrivesFirst(departure, arrival))
    .map(issueOf);
  return issues
    .filter((issue, index) => issues.findIndex((other) => other.offset === issue.offset) === index)
    .toSorted((left, right) => left.offset - right.offset);
};
