import { calendarUnitsOf, type CalendarUnits } from "./calendar-number.ts";
import type { ProseDocument, Sentence } from "./plugin.ts";

/**
 * 年表の行（「1950年4月 設立」「2003年４月大阪証券取引所上場廃止。」）。日付で始まり、すぐに出来事を書く。
 * 行は名詞で止め、文書の文体とも合わせないのが年表の書き方なので、本文の文として数えない。
 *
 * 日付で始まる文が 1 つだけなら本文（「2020年4月当社は…」）。続けて MIN_ROWS 以上並んだときだけ年表と読む。
 * 行の注記（「当時主要製品は…」）が MAX_GAP 文まで挟まっても同じ年表の続きで、注記も年表の中身として数えない。
 */
const MIN_ROWS = 3;
const MAX_GAP = 4;

/** 日付のすぐ後ろにあれば、日付は文の一部で年表の見出しではない（2020年に、2020年4月、当社は）。 */
const JOINS_DATE = /^[\p{Script=Hiragana}\p{P}\p{Sm}]/u;
const DIGITS = /^[0-9０-９]+/u;
const CALENDAR_YEAR_DIGITS = 4;

type Part = { readonly digits: number; readonly rank: number; readonly end: number };

/** 数（全角も）と、その後ろ（空白 1 つまで）の単位。単位が units.chained に無ければ undefined。 */
const partAt = (text: string, at: number, units: CalendarUnits): Part | undefined => {
  const digits = DIGITS.exec(text.slice(at))?.[0];
  if (digits === undefined) return undefined;
  const unitAt = text[at + digits.length] === " " ? at + digits.length + 1 : at + digits.length;
  const rank = units.chained.findIndex((unit) => text.startsWith(unit, unitAt));
  const unit = units.chained[rank];
  if (unit === undefined) return undefined;
  // 「2020年度」は年度という別の語で、年表の日付ではない。
  if ([...units.year].some((word) => word.length > unit.length && text.startsWith(word, unitAt))) return undefined;
  return { digits: digits.length, rank, end: unitAt + unit.length };
};

/** 前より小さい単位（年の後ろの月、月の後ろの日）が続く限り延ばした日付の終わり。 */
const chainEnd = (text: string, last: Part, units: CalendarUnits): number => {
  const next = partAt(text, last.end, units);
  return next !== undefined && next.rank > last.rank ? chainEnd(text, next, units) : last.end;
};

/** 文の頭の見出しの札（「２【沿革】」）。本文に流し込んだ見出しの後ろから、最初の行が始まる。 */
const LEADING_LABEL = /^\s*(?:[0-9０-９]+\s*)?【[^】\n]*】\s*/u;

/** 文の頭（空白と見出しの札を除く）の、年から始まる日付（1950年4月、昭和56年11月1日）の終わり。年は 4 桁か元号付き。日付で始まらなければ undefined。 */
const leadingDateEnd = (text: string, units: CalendarUnits): number | undefined => {
  const lead = LEADING_LABEL.exec(text)?.[0].length ?? text.length - text.trimStart().length;
  const era = units.era.find((name) => text.startsWith(name, lead));
  const year = partAt(text, lead + (era?.length ?? 0), units);
  if (year === undefined || year.rank !== 0 || (era === undefined && year.digits !== CALENDAR_YEAR_DIGITS)) return undefined;
  return chainEnd(text, year, units);
};

/** 年から始まる日付で始まり、助詞も句読点も挟まずに出来事が続く文か。units は日付の単位（年月日の順）と元号。 */
export const opensWithDateStamp = (text: string, units: CalendarUnits): boolean => {
  const end = leadingDateEnd(text, units);
  if (end === undefined) return false;
  const rest = text.slice(end).trimStart();
  return rest !== "" && !JOINS_DATE.test(rest);
};

/** heads[i] が日付で始まる文。年表と読む文の番号（MAX_GAP 文までの間を挟んで MIN_ROWS 以上続く行と、行の間の注記）。 */
export const chronologyRowIndexes = (heads: readonly boolean[]): ReadonlySet<number> => {
  const dated = heads.flatMap((head, index) => (head ? [index] : []));
  const clusters = dated.reduce<number[][]>((acc, index) => {
    const cluster = acc.at(-1);
    const previous = cluster?.at(-1);
    if (cluster !== undefined && previous !== undefined && index - previous - 1 <= MAX_GAP) cluster.push(index);
    else acc.push([index]);
    return acc;
  }, []);
  return new Set(
    clusters
      .filter((cluster) => cluster.length >= MIN_ROWS)
      .flatMap((cluster) => Array.from({ length: (cluster.at(-1) ?? 0) - (cluster[0] ?? 0) + 1 }, (_, offset) => (cluster[0] ?? 0) + offset)),
  );
};

/** 主題の「は」。年表の行は出来事だけを書き、主題を立てない。立てた文（2021年売上高は110億円です。）は日付で始まっても本文。 */
const TOPIC = "は";
const hasTopic = (sentence: Sentence): boolean => (sentence.tokens ?? []).some((token) => token.surface === TOPIC && token.pos === "ADP");

/** 文書の中の、年表の行の文。 */
export const chronologyRows = (doc: ProseDocument): ReadonlySet<Sentence> => {
  const units = calendarUnitsOf(doc);
  const rows = chronologyRowIndexes(doc.sentences.map((sentence) => opensWithDateStamp(sentence.text, units) && !hasTopic(sentence)));
  return new Set(doc.sentences.filter((_, index) => rows.has(index)));
};
