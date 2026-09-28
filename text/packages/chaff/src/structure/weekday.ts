import type { StructureNode } from "../plugin.ts";
import type { StructureIssue } from "./issues.ts";
import { inDocumentOrder } from "./issues.ts";

// 日付と、その横に書いた曜日の食い違い。暦で決まるので、両方読めれば誤りは機械で言える。

const FULL_DATE = /^(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})$/u;

/** 暦の曜日。日曜日が 0。存在しない日（2月30日）は undefined。 */
export const weekdayOf = (value: string): number | undefined => {
  const groups = FULL_DATE.exec(value)?.groups;
  if (groups === undefined) return undefined;
  const [year, month, day] = [Number(groups["y"]), Number(groups["m"]), Number(groups["d"])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.getUTCDay() : undefined;
};

/** 年まで書いた日付で、書いた曜日が暦と違うもの。年の無い日付は曜日を決められないので見ない。 */
export const weekdayMismatches = (tree: StructureNode): StructureIssue[] =>
  inDocumentOrder(tree).flatMap((node) => {
    const written = node.attrs["weekday"];
    if (node.kind !== "date" || typeof written !== "number") return [];
    const actual = weekdayOf(String(node.attrs["value"]));
    return actual === undefined || actual === written ? [] : [{ offset: node.span.start, values: { date: String(node.attrs["value"]), written, actual } }];
  });
