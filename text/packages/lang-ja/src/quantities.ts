import type { Mention } from "chaffjs/plugin";
import { parseJapaneseNumber, toHalfWidth } from "./numbers.ts";
import { isReady, morphemes, type Morph } from "./pos.ts";

// 数量と日付。形態素が使えれば品詞で読み、使えなければ単位の表で読む。

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

/** index から始まる数の並びの終わり（含まない）。 */
const runEnd = (morphs: readonly Morph[], index: number): number => {
  let end = index;
  while (isNumeral(morphs[end]) || isJoiner(morphs, end)) end += 1;
  return end;
};

/** 「第3条」の 3 は番号で、数量ではない。 */
const isOrdinal = (morph: Morph | undefined): boolean => morph?.surface === "第";

/** 数と単位のあいだに置かれうる空白 1 文字。構造の型（structure.ts の SPACE）と同じく、全角空白とタブも含む。 */
const GAP = new Set([" ", "\t", "\u3000"]);

const isSpace = (morph: Morph | undefined): morph is Morph => morph !== undefined && GAP.has(morph.surface);

/**
 * 「1.5 倍」の「倍」は、数とのあいだに空白があると解析器が普通の名詞と読む。
 * 空白を詰めて読み直し、数の直後に来る語が助数詞ならその語を返す。
 */
const unitAfterSpace = (number: string, rest: string): string | undefined => {
  const next = morphemes(toHalfWidth(number + rest.slice(0, 8)))?.find((morph) => morph.start >= number.length);
  return next !== undefined && isCounter(next) ? next.surface : undefined;
};

type Unit = { readonly unit: string; readonly end: number };

const counterAt = (text: string, morphs: readonly Morph[], number: string, end: number): Unit | undefined => {
  const next = morphs[end];
  if (next !== undefined && isCounter(next)) return { unit: next.surface, end: next.end };
  if (!isSpace(next)) return undefined;
  const unit = unitAfterSpace(number, text.slice(next.end));
  return unit === undefined ? undefined : { unit, end: next.end + unit.length };
};

const countedByMorphemes = (text: string, morphs: readonly Morph[]): Counted[] => {
  const found: Counted[] = [];
  let index = 0;
  while (index < morphs.length) {
    const end = runEnd(morphs, index);
    const first = morphs[index];
    if (first !== undefined && end > index && !isOrdinal(morphs[index - 1])) {
      const number = text.slice(first.start, morphs[end - 1]?.end ?? first.end);
      const value = parseJapaneseNumber(number);
      const counter = counterAt(text, morphs, number, end);
      if (value !== undefined && counter !== undefined) found.push({ start: first.start, end: counter.end, value, unit: counter.unit });
    }
    index = Math.max(end, index + 1);
  }
  return found;
};

const NUMBER_RUN = /[0-9０-９][0-9０-９.,]{0,15}|[〇一二三四五六七八九十百千万億]{1,12}/gu;

const countedByTable = (text: string): Counted[] =>
  [...text.matchAll(NUMBER_RUN)].flatMap((match) => {
    // 形態素の経路と同じく、数と単位のあいだの空白 1 つは詰めて読む。
    const after = match.index + match[0].length + (GAP.has(text[match.index + match[0].length] ?? "") ? 1 : 0);
    const unit = UNITS.find((candidate) => text.startsWith(candidate, after));
    const value = parseJapaneseNumber(toHalfWidth(match[0]));
    const ordinal = text[match.index - 1] === "第";
    return unit === undefined || value === undefined || ordinal ? [] : [{ start: match.index, end: after + unit.length, value, unit }];
  });

/** quantities と dates は同じ行を続けて読む。直前の 1 行だけ覚えて、同じ行を二度解析しない。 */
const last: { text: string | undefined; ready: boolean; found: readonly Counted[] } = { text: undefined, ready: false, found: [] };

const counted = (text: string): readonly Counted[] => {
  if (last.text === text && last.ready === isReady()) return last.found;
  // IPADIC は全角の「４月」を一語の名詞と読む。全角数字は 1 文字ずつ半角にしてから読むので、位置は変わらない。
  const half = toHalfWidth(text);
  const morphs = morphemes(half);
  const found = morphs === undefined ? countedByTable(text) : countedByMorphemes(half, morphs);
  Object.assign(last, { text, ready: isReady(), found });
  return found;
};

const pad = (value: number): string => String(value).padStart(2, "0");

const YEAR_FLOOR = 1000;

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

export const quantities = (text: string): Mention[] =>
  toDates(counted(text)).rest.map((item) => ({ start: item.start, end: item.end, attrs: { value: item.value, unit: item.unit } }));

/** 日付のすぐ後ろに書いた曜日（「2026年10月1日（木）」「10月1日 木曜日」）。日曜日が 0。 */
const WEEKDAY_CHARS = "日月火水木金土";
const WEEKDAY_AFTER = /^[ \t\u3000]*(?:[（(](?<paren>[日月火水木金土])(?:曜日?)?[）)]|(?<word>[日月火水木金土])曜日)/u;

const weekdayAfter = (text: string, end: number): number | undefined => {
  const groups = WEEKDAY_AFTER.exec(text.slice(end))?.groups;
  const written = groups?.["paren"] ?? groups?.["word"];
  return written === undefined ? undefined : WEEKDAY_CHARS.indexOf(written);
};

export const dates = (text: string): Mention[] =>
  toDates(counted(text)).dates.map((date) => {
    const weekday = weekdayAfter(text, date.end);
    return weekday === undefined ? date : { ...date, attrs: { ...date.attrs, weekday } };
  });

/**
 * 「1.5 倍になった。」の 1.5 は章番号ではない。番号と続く語のあいだの空白を詰めて読み直し、
 * 続く語が助数詞なら数量の一部と分かる。空白のあるままだと、解析器は「倍」を普通の名詞と読む。
 */
export const countedAfter = (number: string, rest: string): boolean => {
  if (!isReady()) return UNITS.some((unit) => rest.startsWith(unit));
  return unitAfterSpace(number, rest) !== undefined;
};
