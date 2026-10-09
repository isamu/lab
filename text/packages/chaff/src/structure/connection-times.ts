import type { StructureIssue } from "./issues.ts";
import { lineNumberAt, linesOf, type Line } from "./lines.ts";
import { runsOf } from "./runs.ts";
import type { Stop } from "./time-order.ts";
import {
  crossesZones,
  dayShiftOf,
  markBefore,
  markSoonAfter,
  wordOffsets,
  zonesIn,
  type DateSpan,
  type Mark,
  type TimeSpan,
  type TimeWords,
} from "./time-marks.ts";

/**
 * 乗り継ぎの間が、文書に書いた移動の時間より短い所。移動の時間は、移動の語（移動、徒歩、地下鉄、by Metro、coach。語彙表
 * travel-time-word）と同じ文に書いた長さ（約10分、about 40 minutes）だけを使う。実際にかかる時間は推し量らない。
 * 移動の始まりと終わりの時刻は二通りに読む。
 * - 移動そのものを書いた予定（「10:00 京都駅から貸切バスで清水寺へ（約30分）」）は、その時刻に発ち、同じ日の次の予定までに着く。
 * - 予定に添えた移動の時間（「09:55 博多駅で合流（福岡空港から地下鉄で約10分）」）や、時刻の無い移動の文に続けて書いた時刻は、
 *   すぐ前の着の時刻（「福岡 09:50着」、表の到着の列）から移動して、その時刻に間に合う。
 * 日付が違う、翌日の印がある、時刻が戻る（夜をまたぐ）、時間帯の印が違う所は比べない。
 */

/** 移動の時間として読む長さ。minutes は分。 */
export type TravelLength = { readonly start: number; readonly end: number; readonly minutes: number };

/** cues は移動を言う語、bounds は長さを上限として言う語（以内、within）。上限の長さは、それより早く着けるので使わない。 */
export type TravelWords = { readonly cues: readonly Mark[]; readonly bounds: readonly Mark[] };

export type ConnectionInputs = {
  readonly source: string;
  readonly times: readonly TimeSpan[];
  readonly dates: readonly DateSpan[];
  readonly words: TimeWords;
  readonly travel: TravelWords;
  readonly lengths: readonly TravelLength[];
  readonly arrivals: ReadonlySet<number>;
  readonly days: readonly (readonly Stop[])[];
};

const SECONDS_PER_MINUTE = 60;

/** 文の切れ目。leg-times.ts と同じ。 */
const BREAK = /[。．;；!?！？]|\.\s/gu;
/** 括弧書き。中に括弧を入れ子にしたものは、内側から一つずつ外す。 */
const BRACKETED = /[(（][^()（）]*[)）]/gu;
/** 「within 10 minutes」の within と長さの間に挟んでよい字の数。 */
const BOUND_GAP = 1;

/** 発ってから着くまでの間が、書いた移動の時間より短いか。間が負なら（時刻が戻る）、夜をまたいだのか書き間違いか決められないので言わない。 */
export const isTooShort = (gapSeconds: number, travelMinutes: number): boolean => gapSeconds >= 0 && gapSeconds < travelMinutes * SECONDS_PER_MINUTE;

/** 二つの時刻に書いた日付が比べられるか。両方に無いか、同じ書き方で同じ日付なら同じ日。 */
export const isSameDate = (left: string | undefined, right: string | undefined): boolean => left === right;

/** 時間帯の印を見て、二つの行の時刻をそのまま比べられるか。どちらかが時間帯をまたぐか、印が違えば比べない。 */
export const isSameZone = (left: string, right: string, words: TimeWords): boolean => {
  const [leftZones, rightZones] = [zonesIn(left, words), zonesIn(right, words)];
  if (crossesZones(leftZones) || crossesZones(rightZones)) return false;
  return (leftZones[0]?.text ?? "") === (rightZones[0]?.text ?? "");
};

/** 括弧書きを外した残り。 */
export const outsideBrackets = (text: string): string => {
  const stripped = text.replace(BRACKETED, " ");
  return stripped === text ? text : outsideBrackets(stripped);
};

/** text に移動の語が一語として書かれているか。大文字と小文字は区別しない。 */
export const mentionsTravel = (text: string, cues: readonly Mark[]): boolean => {
  const lower = text.toLowerCase();
  return cues.some((cue) => wordOffsets(lower, cue.pattern.toLowerCase()).length > 0);
};

/** 行の中で、at から to までを含む文の範囲（行の頭からの位置）。 */
export const sentenceAround = (text: string, at: number, to: number): { start: number; end: number } => {
  const breaks = [...text.matchAll(BREAK)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
  const start = breaks.filter((cut) => cut.end <= at).at(-1)?.end ?? 0;
  const end = breaks.find((cut) => cut.start >= to)?.start ?? text.length;
  return { start, end };
};

const lineAt = (lines: readonly Line[], offset: number): Line | undefined => {
  const number = lineNumberAt(lines, offset);
  return number === undefined ? undefined : lines[number - 1];
};

/** 長さが上限として書かれている（10分以内、within 10 minutes）か。 */
const isBound = (inputs: ConnectionInputs, line: Line, length: TravelLength): boolean => {
  const head = inputs.source.slice(line.start, length.start).toLowerCase();
  return markSoonAfter(inputs.source, length.end, inputs.travel.bounds, []) !== undefined || markBefore(head, inputs.travel.bounds, BOUND_GAP) !== undefined;
};

/** 移動の時間を書いた長さか。同じ文に移動の語があり、上限として書いたものではない。 */
const isTravel = (inputs: ConnectionInputs, line: Line, length: TravelLength): boolean => {
  const sentence = sentenceAround(line.text, length.start - line.start, length.end - line.start);
  return mentionsTravel(line.text.slice(sentence.start, sentence.end), inputs.travel.cues) && !isBound(inputs, line, length);
};

/** 時刻の前の、同じ行に書いた最後の日付。 */
const dateOf = (inputs: ConnectionInputs, line: Line, time: TimeSpan): string | undefined =>
  inputs.dates.filter((date) => date.start >= line.start && date.end <= time.start).at(-1)?.value;

const shiftOf = (inputs: ConnectionInputs, line: Line, time: TimeSpan): number =>
  dayShiftOf(inputs.source.slice(line.start, time.start), inputs.source, time.end, inputs.words);

const written = (inputs: ConnectionInputs, span: { start: number; end: number }): string => inputs.source.slice(span.start, span.end);

type Leg = { readonly from: TimeSpan; readonly to: TimeSpan };

const issueOf = (inputs: ConnectionInputs, leg: Leg, length: TravelLength): StructureIssue => ({
  offset: leg.to.start,
  values: {
    time: written(inputs, leg.to),
    from: written(inputs, leg.from),
    gap: Math.round((leg.to.seconds - leg.from.seconds) / SECONDS_PER_MINUTE),
    travel: written(inputs, length),
  },
});

const dayOf = (inputs: ConnectionInputs, line: Line): readonly Stop[] | undefined =>
  inputs.days.find((stops) => stops.some((stop) => stop.offset >= line.start && stop.offset <= line.start + line.text.length));

const OPENERS = new Set(["(", "（"]);
const CLOSERS = new Set([")", "）"]);

/** at から to までを囲む一番内側の括弧の中身の範囲（行の頭からの位置）。囲む括弧が無ければ undefined。 */
export const bracketAround = (text: string, at: number, to: number): { start: number; end: number } | undefined => {
  const open = text
    .slice(0, at)
    .split("")
    .reduceRight<{ depth: number; found: number | undefined }>(
      (scan, char, index) => {
        if (scan.found !== undefined) return scan;
        if (CLOSERS.has(char)) return { ...scan, depth: scan.depth + 1 };
        if (!OPENERS.has(char)) return scan;
        return scan.depth === 0 ? { ...scan, found: index } : { ...scan, depth: scan.depth - 1 };
      },
      { depth: 0, found: undefined },
    ).found;
  if (open === undefined) return undefined;
  const close = text
    .slice(to)
    .split("")
    .findIndex((char) => CLOSERS.has(char));
  return close === -1 ? undefined : { start: open + 1, end: to + close };
};

/**
 * 移動そのものを書いた予定か。頭に時刻を書いた予定で、移動の語が括弧の外（行の本文）にある。長さを囲む括弧の中に移動の語が
 * あれば（「（福岡空港から地下鉄で約10分）」）、その括弧はこの予定までの移動を添えたもので、予定は移動ではない。
 */
const isMoveLine = (inputs: ConnectionInputs, line: Line, length: TravelLength): boolean => {
  const aside = bracketAround(line.text, length.start - line.start, length.end - line.start);
  if (aside !== undefined && mentionsTravel(line.text.slice(aside.start, aside.end), inputs.travel.cues)) return false;
  return dayOf(inputs, line) !== undefined && mentionsTravel(outsideBrackets(line.text), inputs.travel.cues);
};

/** 移動そのものを書いた予定の時刻と、同じ日の次の予定の時刻。 */
const scheduledLeg = (inputs: ConnectionInputs, line: Line): Leg | undefined => {
  const day = dayOf(inputs, line);
  const index = day?.findIndex((stop) => stop.offset >= line.start) ?? -1;
  const [start, next] = [day?.[index], day?.[index + 1]];
  if (start === undefined || next === undefined || start.shift !== 0 || next.shift !== 0 || start.zone.startsWith("local:")) return undefined;
  const timeAt = (offset: number): TimeSpan | undefined => inputs.times.find((time) => time.start === offset);
  const [from, to] = [timeAt(start.offset), timeAt(next.offset)];
  return from === undefined || to === undefined ? undefined : { from, to };
};

/** 時刻と同じ並び（続いた箇条書きや表の行）か同じ行にある、その時刻より前の時刻。 */
const timesBeside = (inputs: ConnectionInputs, line: Line, to: TimeSpan): TimeSpan[] => {
  const run = runsOf(inputs.source).find((lines) => lines.some((row) => row.start === line.start));
  const inScope = (time: TimeSpan): boolean =>
    (time.start >= line.start && time.end <= to.start) || (run?.some((row) => time.start >= row.start && time.end <= row.end) ?? false);
  return inputs.times.filter((time) => time.end <= to.start && inScope(time));
};

/** 日付を書いた時刻なら、文書のそれより前の同じ日付の時刻。日付が無ければ、同じ並びか同じ行の、日付の無い前の時刻。 */
const timesBefore = (inputs: ConnectionInputs, lines: readonly Line[], line: Line, to: TimeSpan): TimeSpan[] => {
  const date = dateOf(inputs, line, to);
  const candidates = date === undefined ? timesBeside(inputs, line, to) : inputs.times.filter((time) => time.end <= to.start);
  return candidates.filter((time) => {
    const own = lineAt(lines, time.start);
    return own !== undefined && isSameDate(dateOf(inputs, own, time), date);
  });
};

/**
 * 移動の時間を添えた時刻。予定の行ならその頭の時刻、文なら移動の文の中かその後ろの、最初の着でない時刻。
 * 移動の文より前の時刻は、移動の前の予定で、移動して着く先ではない。
 */
const arrivalTarget = (inputs: ConnectionInputs, line: Line, length: TravelLength): TimeSpan | undefined => {
  const stop = dayOf(inputs, line)?.find((candidate) => candidate.offset >= line.start && candidate.offset <= line.start + line.text.length);
  if (stop !== undefined) return inputs.times.find((time) => time.start === stop.offset);
  const sentenceStart = line.start + sentenceAround(line.text, length.start - line.start, length.end - line.start).start;
  return inputs.times.find((time) => time.start >= sentenceStart && time.end <= line.start + line.text.length && !inputs.arrivals.has(time.start));
};

/** 移動の時間を添えた時刻と、そのすぐ前の着の時刻。すぐ前の時刻が着でなければ、どこから移動したのか分からない。 */
const arrivingLeg = (inputs: ConnectionInputs, lines: readonly Line[], line: Line, length: TravelLength): Leg | undefined => {
  const to = arrivalTarget(inputs, line, length);
  if (to === undefined) return undefined;
  const from = timesBefore(inputs, lines, line, to).at(-1);
  const fromLine = from === undefined ? undefined : lineAt(lines, from.start);
  if (from === undefined || fromLine === undefined || !inputs.arrivals.has(from.start)) return undefined;
  if (shiftOf(inputs, fromLine, from) !== 0 || shiftOf(inputs, line, to) !== 0 || !isSameZone(fromLine.text, line.text, inputs.words)) return undefined;
  return { from, to };
};

/** 移動の時間を書いた長さごとに、間の足りない乗り継ぎ。同じ時刻は一度だけ言う。 */
export const shortConnections = (inputs: ConnectionInputs): StructureIssue[] => {
  const lines = linesOf(inputs.source);
  const issues = inputs.lengths.flatMap((length) => {
    const line = lineAt(lines, length.start);
    if (line === undefined || !isTravel(inputs, line, length)) return [];
    const leg = isMoveLine(inputs, line, length) ? scheduledLeg(inputs, line) : arrivingLeg(inputs, lines, line, length);
    return leg !== undefined && isTooShort(leg.to.seconds - leg.from.seconds, length.minutes) ? [issueOf(inputs, leg, length)] : [];
  });
  return issues
    .filter((issue, index) => issues.findIndex((other) => other.offset === issue.offset) === index)
    .toSorted((left, right) => left.offset - right.offset);
};
