import type { StructureNode } from "../plugin.ts";
import type { StructureIssue } from "./issues.ts";
import { inDocumentOrder } from "./issues.ts";

// 日付と、その横に書いた曜日の食い違い。暦で決まるので、両方読めれば誤りは機械で言える。

const FULL_DATE = /^(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})$/u;
const MONTH_DAY = /^(?<m>\d{2})-(?<d>\d{2})$/u;

/** 暦の曜日。日曜日が 0。存在しない日（2月30日）は undefined。 */
export const weekdayOf = (value: string): number | undefined => {
  const groups = FULL_DATE.exec(value)?.groups;
  if (groups === undefined) return undefined;
  const [year, month, day] = [Number(groups["y"]), Number(groups["m"]), Number(groups["d"])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.getUTCDay() : undefined;
};

const DAY_MS = 86_400_000;
/** 年を書いた日付から 5 か月以内なら、前後の年のどれか一つだけがそこに収まる。半年を超えると、どちらの年とも読める。 */
const YEAR_REACH_DAYS = 153;

const timeOf = (value: string): number | undefined => {
  const groups = FULL_DATE.exec(value)?.groups;
  return groups === undefined || weekdayOf(value) === undefined ? undefined : Date.UTC(Number(groups["y"]), Number(groups["m"]) - 1, Number(groups["d"]));
};

/**
 * 年の無い月日（「10-09」）に、年を書いた日付（anchor、「2026-10-06」）の前後の年のうち、anchor から 5 か月以内に収まる年を付ける。
 * メールや議事録は、文書の日付の年を書いて、そのあとの日付の年を省く。12月の文書の「1月5日」は翌年。どの年も収まらなければ undefined。
 */
export const withNearestYear = (monthDay: string, anchor: string): string | undefined => {
  const groups = MONTH_DAY.exec(monthDay)?.groups;
  const anchorYear = FULL_DATE.exec(anchor)?.groups?.["y"];
  const anchorTime = timeOf(anchor);
  if (groups === undefined || anchorYear === undefined || anchorTime === undefined) return undefined;
  return [-1, 0, 1]
    .map((offset) => `${String(Number(anchorYear) + offset)}-${groups["m"] ?? ""}-${groups["d"] ?? ""}`)
    .find((candidate) => {
      const time = timeOf(candidate);
      return time !== undefined && Math.abs(time - anchorTime) <= YEAR_REACH_DAYS * DAY_MS;
    });
};

/**
 * 年の無い日付の年を決める手がかり。stamp は文書の日付（「更新日：」の段落など）、sectionStarts は見出しで分けた節の始まり、
 * yearHeadings はそのうち見出しが年を名指す節（「## 2024年度」）の始まり。anchorable は、年を決めるのに使ってよい日付か
 * （引用符で日付だけを挙げた例は使わない）。
 */
export type YearContext = {
  readonly stamp?: string | undefined;
  readonly sectionStarts: readonly number[];
  readonly yearHeadings?: readonly number[];
  readonly anchorable?: (node: StructureNode) => boolean;
};

const sectionOf = (starts: readonly number[], offset: number): number => starts.filter((start) => start <= offset).length;

/** 文書の書き出し: 最初の見出しより前と、最初の見出しの節。メールや議事録の頭の日付（日付：、日時：）が書かれる所。 */
const OPENING_SECTIONS = 1;

/**
 * 年の無い日付の年を決める、年を書いた日付。同じ節のすぐ前のもの（前に無ければ後ろの最初のもの）。節に無ければ文書の日付、
 * それも無ければ書き出しの最初の日付。年度ごとの見出しの下の「1月24日（火）」はその節の年で読み、別の節の日付の年では読まない。
 */
const anchorOf = (dated: readonly StructureNode[], node: StructureNode, context: YearContext): string | undefined => {
  const section = sectionOf(context.sectionStarts, node.span.start);
  const inSection = dated.filter((other) => sectionOf(context.sectionStarts, other.span.start) === section);
  const nearest = inSection.findLast((other) => other.span.start < node.span.start) ?? inSection[0];
  // 見出しが年を名指す節（「## 2024年度」）の日付は、その年の中にある。節の外の日付からは決めない。
  const sectionStart = context.sectionStarts[section - 1];
  if (nearest === undefined && sectionStart !== undefined && (context.yearHeadings ?? []).includes(sectionStart)) return undefined;
  const opening = dated.find((other) => sectionOf(context.sectionStarts, other.span.start) <= OPENING_SECTIONS);
  const stamp = context.stamp !== undefined && FULL_DATE.test(context.stamp) ? context.stamp : undefined;
  const fromTree = (found: StructureNode | undefined): string | undefined => (found === undefined ? undefined : String(found.attrs["value"]));
  return fromTree(nearest) ?? stamp ?? fromTree(opening);
};

/** 日付の年月日。年の無い日付は、近くの年を書いた日付から年を決めて付ける。決まらなければ undefined。 */
const fullValueOf = (dated: readonly StructureNode[], node: StructureNode, context: YearContext): string | undefined => {
  const value = String(node.attrs["value"]);
  if (!MONTH_DAY.test(value)) return value;
  const anchor = anchorOf(dated, node, context);
  return anchor === undefined ? undefined : withNearestYear(value, anchor);
};

/**
 * 書いた曜日が暦と違う日付。年の無い日付は、年を書いた日付（anchorOf）から 5 か月以内に収まる年として比べる。
 * 年を書いた日付が文書に無いか、どの年も収まらなければ、曜日を決められないので見ない。
 */
export const weekdayMismatches = (tree: StructureNode, context: YearContext = { sectionStarts: [] }): StructureIssue[] => {
  const dates = inDocumentOrder(tree).filter((node) => node.kind === "date");
  const anchorable = context.anchorable ?? (() => true);
  const dated = dates.filter((node) => timeOf(String(node.attrs["value"])) !== undefined && anchorable(node));
  return dates.flatMap((node) => {
    const written = node.attrs["weekday"];
    if (typeof written !== "number") return [];
    const value = fullValueOf(dated, node, context);
    const actual = value === undefined ? undefined : weekdayOf(value);
    return value === undefined || actual === undefined || actual === written ? [] : [{ offset: node.span.start, values: { date: value, written, actual } }];
  });
};
