import { digitRunAround } from "./number-name.ts";
import type { Span, Token } from "./plugin.ts";

/**
 * 日付・時刻として書かれた数（9月、3時、2026年、10月1日、10時5分）。数を詰めて書くのが決まりで、空け方の好みではない。
 * 長さ（3ヶ月、3時間、3日間）は別の語で書くので、ここには入らない。
 *
 * 単位は語彙表から渡す。chained は日付・時刻の単位を大きい順に（年月日時分秒）。大きい単位の後ろに小さい単位を続けて書けば
 * 一つの日付・時刻になる。「2008年 2年連続」のように同じ単位や大きい単位が続けば、別のものの始まり。
 * positional は数の後ろに置くだけで位置を言う単位（月、時）。year は 4 桁の数の後ろで暦の年を言う単位（年、年度）。
 * 「5日」「5分」「3年」のように、単位だけでは長さと見分けのつかないものは、位置を言う単位と続けて書いたときだけ日付・時刻と読む。
 */
export type CalendarUnits = { readonly chained: readonly string[]; readonly positional: ReadonlySet<string>; readonly year: ReadonlySet<string> };

/** 日付・時刻の数の並び。first は日付の頭の数、inner は前の単位に続く数（2026年9月の 9）。 */
export type CalendarRun = { readonly run: Span; readonly place: "first" | "inner" };

/** 数の並びと、その後ろの単位の終わり（文の中の位置）。rank は chained の中の単位の順（無ければ -1）、anchored は単位だけで日付・時刻と分かるもの。 */
type Part = { readonly run: Span; readonly unitEnd: number; readonly rank: number; readonly anchored: boolean };

const DIGIT = /\d/u;
const CALENDAR_YEAR = /^\d{4}$/u;

/** text の中の数の並び（数字・小数点・ハイフン）を左から。 */
const digitRuns = (text: string): Span[] => {
  const runs: Span[] = [];
  let at = 0;
  while (at < text.length) {
    const run = DIGIT.test(text[at] ?? "") ? digitRunAround(text, at) : undefined;
    if (run !== undefined) runs.push(run);
    at = Math.max(run?.end ?? 0, at + 1);
  }
  return runs;
};

/** 空白 1 つを越えた位置。 */
const pastSpace = (text: string, at: number): number => (text[at] === " " ? at + 1 : at);

const isUnit = (surface: string, units: CalendarUnits): boolean => units.chained.includes(surface) || units.positional.has(surface) || units.year.has(surface);

const isAnchor = (digits: string, surface: string, units: CalendarUnits): boolean =>
  units.positional.has(surface) || (units.year.has(surface) && CALENDAR_YEAR.test(digits));

/** 数のすぐ後ろ（空白 1 つまで）の語が日付・時刻の単位なら、その組。語の切れ目が合わなければ組にしない。 */
const partOf = (text: string, run: Span, tokens: readonly Token[], base: number, units: CalendarUnits): Part | undefined => {
  const unit = tokens.find((token) => token.span.start === base + pastSpace(text, run.end));
  if (unit === undefined || !isUnit(unit.surface, units)) return undefined;
  const rank = units.chained.indexOf(unit.surface);
  return { run, unitEnd: unit.span.end - base, rank, anchored: isAnchor(text.slice(run.start, run.end), unit.surface, units) };
};

/** 前の組の単位のすぐ後ろ（空白 1 つまで）から始まり、単位が前より小さい組か。 */
const continues = (text: string, previous: Part | undefined, part: Part): boolean =>
  previous !== undefined && previous.rank >= 0 && part.rank > previous.rank && part.run.start === pastSpace(text, previous.unitEnd);

/** 前の組に続く組を、同じ日付・時刻にまとめる。 */
const chainsOf = (text: string, parts: readonly Part[]): Part[][] =>
  parts.reduce<Part[][]>((chains, part) => {
    const chain = chains.at(-1);
    if (chain !== undefined && continues(text, chain.at(-1), part)) chain.push(part);
    else chains.push([part]);
    return chains;
  }, []);

/**
 * 文 text の中の、日付・時刻の数の並び。tokens は文書全体の座標で、base は text の先頭の位置。
 * 品詞が無ければ判断せず、何も返さない。
 */
export const calendarRuns = (text: string, tokens: readonly Token[] | undefined, base: number, units: CalendarUnits): CalendarRun[] => {
  if (tokens === undefined) return [];
  const parts = digitRuns(text).flatMap((run) => partOf(text, run, tokens, base, units) ?? []);
  return chainsOf(text, parts)
    .filter((chain) => chain.some((part) => part.anchored))
    .flatMap((chain) => chain.map((part, index): CalendarRun => ({ run: part.run, place: index === 0 ? "first" : "inner" })));
};
