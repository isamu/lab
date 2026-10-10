import { parseJapaneseNumber, toHalfWidth } from "./numbers.ts";
import { escapeRegExp } from "./regexp.ts";

// 元号の年と西暦の年を並べて書いた年（令和6年（2024年）、2024年（令和6年）、令和6（2024）年）。純粋。元号とその元年は語彙表 calendar-era が言う。

/** 元号と、その元年の西暦の年（令和は 2019）。 */
export type Era = { readonly name: string; readonly firstYear: number };

/**
 * 括弧で言い換えた年の一つ。year は括弧の外に書いた年を西暦にしたもの、glossYear は括弧の中の年を西暦にしたもの。
 * 二つが違えば、どちらかの書き違い。
 */
export type GlossedYear = { readonly start: number; readonly end: number; readonly year: number; readonly glossYear: number };

const ERA_NUMBER = "(?:[0-9０-９]{1,2}|[一二三四五六七八九十]{1,3}|元)";
const WESTERN = "(?:[0-9０-９]{4}|[〇一二三四五六七八九]{4})";
const OPEN = "[（(]";
const CLOSE = "[）)]";
/** 元号と年の数、年の数と単位のあいだの空白 1 つ（令和 6 年）。 */
const GAP = "[ \\u3000]?";

/** 西暦の年の前に数字が続けば、もっと長い数の一部（12024年）。 */
const NOT_AFTER_DIGIT = "(?<![0-9０-９〇一二三四五六七八九十])";

/** 括弧の後ろの単位が「年度」なら、暦の年でなく会計の年（令和6（2024）年度）。 */
const CALENDAR_YEAR_AFTER = "年(?!度)";

const shapes = (eras: string): readonly string[] => {
  const era = `(?<era>${eras})${GAP}(?<n>${ERA_NUMBER})${GAP}`;
  const western = `${NOT_AFTER_DIGIT}(?<w>${WESTERN})`;
  return [
    `${era}年${OPEN}${western}年${CLOSE}`,
    `${era}${OPEN}${western}${CLOSE}${CALENDAR_YEAR_AFTER}`,
    `${western}年${OPEN}${era}年${CLOSE}`,
    `${western}${OPEN}${era}${CLOSE}${CALENDAR_YEAR_AFTER}`,
  ];
};

/** 元号の年の数。元年は 1。 */
const eraNumber = (written: string): number | undefined => (written === "元" ? 1 : parseJapaneseNumber(toHalfWidth(written)));

const KANJI_DIGITS = "〇一二三四五六七八九";

/** 西暦の年。漢数字（二〇二四）は位取りでなく一字ずつ読む。 */
const readWestern = (written: string): number =>
  Number([...toHalfWidth(written)].map((char) => (KANJI_DIGITS.includes(char) ? String(KANJI_DIGITS.indexOf(char)) : char)).join(""));

const glossedOf = (match: RegExpExecArray, eras: readonly Era[]): GlossedYear[] => {
  const groups = match.groups ?? {};
  const era = eras.find((candidate) => candidate.name === groups["era"]);
  const number = eraNumber(groups["n"] ?? "");
  const western = readWestern(groups["w"] ?? "");
  if (era === undefined || number === undefined || number < 1) return [];
  const fromEra = era.firstYear + number - 1;
  const eraFirst = match[0].startsWith(era.name);
  const [year, glossYear] = eraFirst ? [fromEra, western] : [western, fromEra];
  return [{ start: match.index, end: match.index + match[0].length, year, glossYear }];
};

/** 文の中の、括弧で言い換えた年を読む関数。書き方ごとに探し、出てきた順に並べる。元号が無ければ何も読まない。 */
export const glossedYearReader = (eras: readonly Era[]): ((text: string) => GlossedYear[]) => {
  if (eras.length === 0) return () => [];
  const patterns = shapes(eras.map((era) => escapeRegExp(era.name)).join("|")).map((shape) => new RegExp(shape, "gu"));
  return (text) =>
    patterns.flatMap((pattern) => [...text.matchAll(pattern)].flatMap((match) => glossedOf(match, eras))).toSorted((left, right) => left.start - right.start);
};
