import type { Mention } from "chaffjs/plugin";
import { parseJapaneseNumber, toHalfWidth } from "./numbers.ts";
import { isReady, morphemes, type Morph } from "./pos.ts";
import { glossedYearReader } from "./era-year.ts";
import { loadCalendarEras } from "./lexicons.ts";
import { escapeRegExp } from "./regexp.ts";

// 数量と日付。形態素が使えれば品詞で読み、使えなければ単位の表で読む。

/** 元号と元年の西暦の年は語彙表 calendar-era が言う。 */
const ERAS = loadCalendarEras();

type Counted = { readonly start: number; readonly end: number; readonly value: number; readonly unit: string };

const PERCENT = new Set(["%", "％"]);
/** 形態素が無いときの単位の表。長いものから当てる。形態素があれば、助数詞はすべて読める。 */
const UNITS = [
  "営業日",
  "パーセント",
  "か月",
  "ヶ月",
  "カ月",
  "箇月",
  "週間",
  "時間",
  "万円",
  "日",
  "年",
  "月",
  "分",
  "円",
  "件",
  "回",
  "人",
  "名",
  "倍",
  "個",
  "つ",
  "%",
  "％",
];

const isNumeral = (morph: Morph | undefined): boolean => morph !== undefined && morph.pos === "名詞" && morph.detail1 === "数";

/** IPADIC は「4月」の「月」を助数詞でなく普通の名詞と読む。数の直後にあるときだけ、暦の月として数える。 */
const COMMON_NOUN_COUNTERS = new Set(["月"]);

const isCounter = (morph: Morph | undefined): boolean =>
  morph !== undefined && (morph.detail2 === "助数詞" || PERCENT.has(morph.surface) || COMMON_NOUN_COUNTERS.has(morph.surface));

/** 「1.5」は 1 . 5 と切られる。数に挟まれた点とカンマは数の一部として読む。 */
const isJoiner = (morphs: readonly Morph[], index: number): boolean => {
  const morph = morphs[index];
  return morph !== undefined && [".", ",", "．", "，"].includes(morph.surface) && isNumeral(morphs[index - 1]) && isNumeral(morphs[index + 1]);
};

/** 桁の語。「26.7 万行」「1.2 万円」のように、数と空白 1 つを挟んで書かれても同じ数の一部。兆は数として読めないので入れない。 */
const MULTIPLIERS = new Set(["万", "億"]);
/** 算用数字の後ろの桁の語（「2,400 百万円」「1,320 千円」）の頭。空白を挟んでも数の続き。 */
const SCALE_HEADS = new Set(["十", "百", "千", ...MULTIPLIERS]);

/** 数と桁の語のあいだの空白 1 つ。 */
const isSpacedMultiplier = (morphs: readonly Morph[], index: number): boolean =>
  isSpace(morphs[index]) && isNumeral(morphs[index - 1]) && SCALE_HEADS.has(morphs[index + 1]?.surface ?? "");

/** index から始まる数の並びの終わり（含まない）。 */
const runEnd = (morphs: readonly Morph[], index: number): number => {
  let end = index;
  while (isNumeral(morphs[end]) || isJoiner(morphs, end) || isSpacedMultiplier(morphs, end)) end += 1;
  return end;
};

/** 「第3条」の 3 は番号で、数量ではない。 */
const isOrdinal = (morph: Morph | undefined): boolean => morph?.surface === "第";

/** 助数詞の後ろの「目」「め」（3つ目、2回目、1年目、一つめ）も順番で、数量ではない。「目標」は一語なので当たらない。 */
const ORDINAL_SUFFIXES: ReadonlySet<string> = new Set(["目", "め"]);

const isOrdinalSuffix = (morph: Morph | undefined): boolean => morph?.pos === "名詞" && ORDINAL_SUFFIXES.has(morph.surface);

/**
 * 解析器の無いときに順番と読む単位の後ろ。漢字の続かない「目」（「2回目標」「5人目線」の目は次の語の頭）と、
 * 「めど」でない「め」（「10日めどに」は期限）。「つ」の後ろの漢字は見ない。「3つ選ぶ」のように数えた後ろに漢字が来るほうが、
 * 「三つ巴」のような一語より多い。
 */
const ORDINAL_BY_TABLE = /^(?:目(?!\p{Script=Han})|め(?!ど))/u;

/** 数と単位のあいだに置かれうる空白 1 文字。構造の型（structure.ts の SPACE）と同じく、全角空白とタブも含む。 */
const GAP = new Set([" ", "\t", "\u3000"]);

const isSpace = (morph: Morph | undefined): morph is Morph => morph !== undefined && GAP.has(morph.surface);

const SPACES = /[ \t\u3000]/gu;

/** 数量の後ろを読むのに要る文字数。「万人が」「億円の」まで見えれば足りる。 */
const LOOKAHEAD = 8;

/**
 * 「1.5 倍」の「倍」は、数とのあいだに空白があると解析器が普通の名詞と読む。
 * 空白を詰めて読み直し、数の直後に来る語が助数詞ならその語を返す。
 */
const rereadAfterSpace = (number: string, rest: string): Morph[] => morphemes(toHalfWidth(number + rest.slice(0, LOOKAHEAD))) ?? [];

/**
 * 空白の後ろだけを読むと、名詞につく接頭詞と名詞で始まる（「1.4 本利用ルール」「1.2 本規約」の「本」）。詰めて読み直すと
 * 助数詞に見えるが、行頭の番号の後ろなら、書き手が空けたのは番号と題のあいだ。「3 本の鉛筆」の「本」は単独で名詞、
 * 「0.5 枚の紙」の「枚」は数につく接頭詞と読まれるので、どちらも数量のまま。
 * 文中の数量には使わない。「10 両編成」の「両」も単独では名詞につく接頭詞と読まれる。
 */
const opensWithPrefix = (rest: string): boolean => {
  const [first, second] = morphemes(toHalfWidth(rest.slice(0, LOOKAHEAD))) ?? [];
  return first?.pos === "接頭詞" && first.detail1 === "名詞接続" && second?.pos === "名詞";
};

const unitAfterSpace = (number: string, rest: string): string | undefined => {
  const next = rereadAfterSpace(number, rest).find((morph) => morph.start >= number.length);
  return next !== undefined && isCounter(next) ? next.surface : undefined;
};

/** ordinal: 単位のすぐ後ろが順番の「目」「め」。空白を詰めて読み直したときは、読み直した語で見る（「3 つめ」の「つめ」は詰めると つ + め）。 */
type Unit = { readonly unit: string; readonly end: number; readonly ordinal: boolean };

/** Punctuation and symbols only: what the analyser glues to a percent sign as one unknown word (「%、」「%）」「%。」). */
const MARKS_ONLY = /^[\p{P}\p{S}]+$/u;

/** 「45%、」: IPADIC reads a half-width percent sign and the comma after it as one word. The sign alone is the unit. */
const gluedPercent = (morph: Morph | undefined): Unit | undefined => {
  const sign = morph?.surface.charAt(0) ?? "";
  if (morph === undefined || !PERCENT.has(sign) || !MARKS_ONLY.test(morph.surface.slice(1))) return undefined;
  return { unit: sign, end: morph.start + sign.length, ordinal: false };
};

const counterAt = (text: string, morphs: readonly Morph[], number: string, end: number): Unit | undefined => {
  const next = morphs[end];
  if (next !== undefined && isCounter(next)) return { unit: next.surface, end: next.end, ordinal: isOrdinalSuffix(morphs[end + 1]) };
  const glued = gluedPercent(next);
  if (glued !== undefined) return glued;
  if (!isSpace(next)) return undefined;
  const rest = text.slice(next.end);
  const unit = unitAfterSpace(number, rest);
  if (unit === undefined) return undefined;
  const ordinal = isOrdinalSuffix(rereadAfterSpace(number, rest).find((morph) => morph.start === number.length + unit.length));
  return { unit, end: next.end + unit.length, ordinal };
};

const countedByMorphemes = (text: string, morphs: readonly Morph[]): Counted[] => {
  const found: Counted[] = [];
  let index = 0;
  while (index < morphs.length) {
    const end = runEnd(morphs, index);
    const first = morphs[index];
    if (first !== undefined && end > index && !isOrdinal(morphs[index - 1])) {
      const number = text.slice(first.start, morphs[end - 1]?.end ?? first.end).replace(SPACES, "");
      const value = parseJapaneseNumber(number);
      const counter = counterAt(text, morphs, number, end);
      if (value !== undefined && counter !== undefined && !counter.ordinal) found.push({ start: first.start, end: counter.end, value, unit: counter.unit });
    }
    index = Math.max(end, index + 1);
  }
  return found;
};

/** 算用数字は、すぐ後ろか空白 1 つを挟んだ桁の語（1.2万、1.2 万、2,400百万）まで一つの数。形態素の経路と同じ読み方。 */
const NUMBER_RUN = /[0-9０-９][0-9０-９.,]{0,15}(?:[ \t\u3000]?[十百千]?[万億千])?|[〇一二三四五六七八九十百千万億]{1,12}/gu;

export const countedByTable = (text: string): Counted[] =>
  [...text.matchAll(NUMBER_RUN)].flatMap((match) => {
    // 形態素の経路と同じく、数と単位のあいだの空白 1 つは詰めて読む。
    const after = match.index + match[0].length + (GAP.has(text[match.index + match[0].length] ?? "") ? 1 : 0);
    const unit = UNITS.find((candidate) => text.startsWith(candidate, after));
    const value = parseJapaneseNumber(toHalfWidth(match[0].replace(SPACES, "")));
    const ordinal = text[match.index - 1] === "第" || (unit !== undefined && ORDINAL_BY_TABLE.test(text.slice(after + unit.length)));
    return unit === undefined || value === undefined || ordinal ? [] : [{ start: match.index, end: after + unit.length, value, unit }];
  });

/** quantities と dates は同じ行を続けて読む。直前の 1 行だけ覚えて、同じ行を二度解析しない。 */
const last: { text: string | undefined; ready: boolean; found: readonly Counted[] } = { text: undefined, ready: false, found: [] };

/** これより小さい「年」は期間（3年）で、暦の年ではない。 */
const YEAR_FLOOR = 1000;

/**
 * 元号の年と西暦の年を括弧で並べた年（令和6年（2024年）、2024年（令和8年）、令和6（2024）年）は、一つの暦の年。
 * 括弧の外に書いた年を読み、中の年は数量でも別の日付でもない。年の後ろに月が続けば、一つの日付として読める。
 */
const GLOSSED_YEARS = glossedYearReader(ERAS);

const withGlossedYears = (text: string, found: readonly Counted[]): Counted[] => {
  const glossed = GLOSSED_YEARS(text);
  if (glossed.length === 0) return [...found];
  const years = glossed.map((item): Counted => ({ start: item.start, end: item.end, value: item.year, unit: "年" }));
  const outside = found.filter((item) => !years.some((year) => item.start < year.end && year.start < item.end));
  return [...outside, ...years].toSorted((left, right) => left.start - right.start);
};

const counted = (text: string): readonly Counted[] => {
  if (last.text === text && last.ready === isReady()) return last.found;
  // IPADIC は全角の「４月」を一語の名詞と読む。全角数字は 1 文字ずつ半角にしてから読むので、位置は変わらない。
  const half = toHalfWidth(text);
  const morphs = morphemes(half);
  const found = withGlossedYears(half, morphs === undefined ? countedByTable(text) : countedByMorphemes(half, morphs));
  Object.assign(last, { text, ready: isReady(), found });
  return found;
};

const pad = (value: number): string => String(value).padStart(2, "0");

type DateMatch = { readonly date: Mention; readonly used: number };

/** right が left の直後に続く、単位 unit の数量か。「2024年 4月」のように間が空けば日付にしない。 */
const follows = (left: Counted | undefined, right: Counted | undefined, unit: string): right is Counted =>
  left !== undefined && right?.unit === unit && right.start === left.end;

const dateOf = (parts: readonly Counted[], value: string): DateMatch => ({
  date: { start: parts[0]?.start ?? 0, end: parts.at(-1)?.end ?? 0, attrs: { value } },
  used: parts.length,
});

/** 「2024年4月1日」「2024年4月」。 */
const yearMonth = (year: Counted | undefined, month: Counted | undefined, day: Counted | undefined): DateMatch | undefined => {
  if (year?.unit !== "年" || !follows(year, month, "月")) return undefined;
  const base = `${String(year.value)}-${pad(month.value)}`;
  return follows(month, day, "日") ? dateOf([year, month, day], `${base}-${pad(day.value)}`) : dateOf([year, month], base);
};

/** 「4月1日」。年の無い日付。 */
const monthDay = (month: Counted | undefined, day: Counted | undefined): DateMatch | undefined =>
  month?.unit === "月" && follows(month, day, "日") ? dateOf([month, day], `${pad(month.value)}-${pad(day.value)}`) : undefined;

/** 年だけのときは 1000 以上なら年（2024年）、それより小さければ期間（3年）。 */
const yearOnly = (year: Counted | undefined): DateMatch | undefined =>
  year?.unit === "年" && year.value >= YEAR_FLOOR ? dateOf([year], String(year.value)) : undefined;

/** 隣り合った「年」「月」「日」を 1 つの日付にする。「2024年4月1日」は 3 つの数量ではなく 2024-04-01。 */
const toDates = (items: readonly Counted[]): { readonly dates: Mention[]; readonly rest: Counted[] } => {
  const dates: Mention[] = [];
  const rest: Counted[] = [];
  let index = 0;
  while (index < items.length) {
    const [first, second, third] = [items[index], items[index + 1], items[index + 2]];
    const found = yearMonth(first, second, third) ?? monthDay(first, second) ?? yearOnly(first);
    if (found !== undefined) dates.push(found.date);
    else if (first !== undefined) rest.push(first);
    index += found?.used ?? 1;
  }
  return { dates, rest };
};

/**
 * 「2026-10-02」。前後に数字や記号が続くもの（版 1.2026-10-02、URL やファイルの名前、時刻の付いた日時、番号の一部）は読まない。
 * 4 桁と 2 桁 2 つの組でも、月と日として読めないもの、1000 より小さい年（0120-12-34）は日付でない。
 */
const ISO_DATE = /(?<![\w/.\-０-９])(?<y>[0-9０-９]{4})-(?<m>[0-9０-９]{2})-(?<d>[0-9０-９]{2})(?![\w/\-０-９]|\.[\w０-９])/gu;
const MONTHS_IN_YEAR = 12;
const DAYS_IN_MONTH = 31;

const inRange = (value: number, high: number): boolean => value >= 1 && value <= high;

const isoDateOf = (match: RegExpExecArray): Mention[] => {
  const [year, month, day] = ["y", "m", "d"].map((name) => Number(toHalfWidth(match.groups?.[name] ?? "")));
  if (year === undefined || month === undefined || day === undefined) return [];
  if (year < YEAR_FLOOR || !inRange(month, MONTHS_IN_YEAR) || !inRange(day, DAYS_IN_MONTH)) return [];
  return [{ start: match.index, end: match.index + match[0].length, attrs: { value: `${String(year)}-${pad(month)}-${pad(day)}` } }];
};

const isoDates = (text: string): Mention[] => [...text.matchAll(ISO_DATE)].flatMap(isoDateOf);

type Span = { readonly start: number; readonly end: number };

/** ISO の日付の中の数（「02」）を、数量や年月日の日付として二重に読まない。 */
const overlaps = (item: Span, spans: readonly Span[]): boolean => spans.some((span) => item.start < span.end && span.start < item.end);

export const quantities = (text: string): Mention[] => {
  const iso = isoDates(text);
  return toDates(counted(text))
    .rest.filter((item) => !overlaps(item, iso))
    .map((item) => ({ start: item.start, end: item.end, attrs: { value: item.value, unit: item.unit } }));
};

/** 日付のすぐ後ろに書いた曜日（「2026年10月1日（木）」「10月1日 木曜日」）。日曜日が 0。 */
const WEEKDAY_CHARS = "日月火水木金土";
const WEEKDAY_AFTER = /^[ \t\u3000]*(?:[（(](?<paren>[日月火水木金土])(?:曜日?)?[）)]|(?<word>[日月火水木金土])曜日)/u;

const weekdayAfter = (text: string, end: number): number | undefined => {
  const groups = WEEKDAY_AFTER.exec(text.slice(end))?.groups;
  const written = groups?.["paren"] ?? groups?.["word"];
  return written === undefined ? undefined : WEEKDAY_CHARS.indexOf(written);
};

/** 元号の最初の年の前年（令和1年 = 2019 年）。元号で書いた日付を西暦の日付にする。 */
const ERA_BASE: ReadonlyMap<string, number> = new Map(ERAS.map((era) => [era.name, era.firstYear - 1]));
const ERA_NAMES = ERAS.map((era) => escapeRegExp(era.name)).join("|");
const LONGEST_ERA = Math.max(0, ...ERAS.map((era) => era.name.length));
const ERA_BEFORE = new RegExp(`(?<era>${ERA_NAMES})$`, "u");
/** 月の付いた日付の年を直す。年だけ（「昭和二十二年法律」）は 1000 に届かないので、はじめから日付でなく期間の数量。 */
const ERA_DATE = /^(?<year>\d{1,2})-(?<rest>.+)$/u;

/** 「令和元年10月1日」: 元年は数として読めないので、年の無い 10-01 になっている。その前の「元号 + 元年」を 1 年として足す。 */
const FIRST_YEAR = "元年";
const FIRST_YEAR_BEFORE = new RegExp(`(?<era>${ERA_NAMES})${FIRST_YEAR}$`, "u");
const MONTH_DAY = /^\d{2}-\d{2}$/u;

const inFirstEraYear = (text: string, date: Mention): Mention | undefined => {
  if (!MONTH_DAY.test(String(date.attrs["value"]))) return undefined;
  const found = FIRST_YEAR_BEFORE.exec(text.slice(Math.max(0, date.start - LONGEST_ERA - FIRST_YEAR.length), date.start));
  const base = found?.groups?.["era"] === undefined ? undefined : ERA_BASE.get(found.groups["era"]);
  if (found === null || base === undefined) return undefined;
  return { ...date, start: date.start - found[0].length, attrs: { ...date.attrs, value: `${String(base + 1)}-${String(date.attrs["value"])}` } };
};

const inWesternYear = (text: string, date: Mention): Mention => {
  const first = inFirstEraYear(text, date);
  if (first !== undefined) return first;
  const parts = ERA_DATE.exec(String(date.attrs["value"]))?.groups;
  const era = ERA_BEFORE.exec(text.slice(Math.max(0, date.start - LONGEST_ERA), date.start))?.groups?.["era"];
  const base = era === undefined ? undefined : ERA_BASE.get(era);
  if (parts === undefined || era === undefined || base === undefined) return date;
  const value = `${String(base + Number(parts["year"]))}-${parts["rest"] ?? ""}`;
  return { ...date, start: date.start - era.length, attrs: { ...date.attrs, value } };
};

const withWeekday = (text: string, date: Mention): Mention => {
  const weekday = weekdayAfter(text, date.end);
  return weekday === undefined ? date : { ...date, attrs: { ...date.attrs, weekday } };
};

export const dates = (text: string): Mention[] => {
  const iso = isoDates(text);
  const written = toDates(counted(text))
    .dates.map((found) => inWesternYear(text, found))
    .filter((date) => !overlaps(date, iso));
  return [...written, ...iso].toSorted((left, right) => left.start - right.start).map((date) => withWeekday(text, date));
};

/** 数がそこで閉じる。助数詞（「万人」）か、名詞でない語（「万を」「万。」）か、行の終わり。 */
const closesNumber = (morph: Morph | undefined): boolean => morph === undefined || isCounter(morph) || morph.pos !== "名詞";

/**
 * 桁の語が一語として続く。「1.5 万を超える」のように単位が無くても数の一部。
 * 「万葉集」は一語で、「万葉の」「万一」は桁の語の後ろに名詞や数が続くので、どれも数の続きではない。
 */
export const continuesWithMultiplier = (morphs: readonly Morph[], index: number): boolean =>
  MULTIPLIERS.has(morphs[index]?.surface ?? "") && isNumeral(morphs[index]) && closesNumber(morphs[index + 1]);

const multiplierAfter = (number: string, rest: string): boolean => {
  const morphs = morphemes(toHalfWidth(number + rest.slice(0, LOOKAHEAD))) ?? [];
  return continuesWithMultiplier(
    morphs,
    morphs.findIndex((morph) => morph.start >= number.length),
  );
};

const startsWithUnit = (text: string): boolean => UNITS.some((unit) => text.startsWith(unit));

/** 解析器の無いときの、数がそこで閉じる字。行の終わり、表の単位、仮名の助詞や句読点（「万を」「万。」）。漢字（「万葉」「万全」）は閉じない。 */
const CLOSES_BY_TABLE = /^(?:$|[\p{Script=Hiragana}\p{P}\s])/u;

/** 解析器の無いときの読み方。桁の語が先にあれば、その後ろで数が閉じるかを見る。 */
const countedByTableAfter = (rest: string): boolean => {
  if (!MULTIPLIERS.has(rest[0] ?? "")) return startsWithUnit(rest);
  const after = rest.slice(1);
  return startsWithUnit(after) || CLOSES_BY_TABLE.test(after);
};

/**
 * 「1.5 倍になった。」「1.5 万人が参加した。」の 1.5 は章番号ではない。番号と続く語のあいだの空白を詰めて読み直し、
 * 続く語が助数詞なら数量の一部と分かる。空白のあるままだと、解析器は「倍」を普通の名詞と読む。
 */
export const countedAfter = (number: string, rest: string): boolean => {
  if (!isReady()) return countedByTableAfter(rest);
  return (unitAfterSpace(number, rest) !== undefined && !opensWithPrefix(rest)) || multiplierAfter(number, rest);
};
