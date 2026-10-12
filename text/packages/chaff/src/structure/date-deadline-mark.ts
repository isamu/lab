import { escapeRegExp } from "../orthography.ts";

/**
 * 日付を締め切りにする語が、その日付に付いているか（9月18日までに、by September 18）。語の position が日付のどちら側に立つかを言う
 * （「までに」は after、「by」は before）。position の無い語は読まない。日付の後ろの語との間には空白、曜日などの括弧（（金））、
 * 時刻（17時、5:00 p.m.）を置いてよく、日付の前の語との間には空白だけを置く。行はまたがない。Pure.
 */
export type DateSpan = { readonly offset: number; readonly end: number };
export type DeadlineMark = { readonly pattern: string; readonly position?: "before" | "after" | undefined };

const SPACE = String.raw`[^\S\n]`;
const GAP_AFTER = String.raw`${SPACE}*(?:[（(][^）)\n]{1,8}[）)])?${SPACE}*(?:\d{1,2}(?:[:：]\d{2}|時(?:\d{1,2}分)?)(?:${SPACE}*[ap]\.?m\.?)?)?${SPACE}*`;
const NEAR = 40;

const isWordy = (text: string): boolean => /[a-z]/iu.test(text);

const followingPattern = (word: string): RegExp => new RegExp(`^${GAP_AFTER}${escapeRegExp(word)}${isWordy(word) ? "(?![a-z])" : ""}`, "iu");
const precedingPattern = (word: string): RegExp => new RegExp(`${isWordy(word) ? "(?<![a-z])" : ""}${escapeRegExp(word)}${SPACE}+$`, "iu");

export const isDeadlineDate = (source: string, date: DateSpan, marks: readonly DeadlineMark[]): boolean => {
  const following = source.slice(date.end, date.end + NEAR);
  const preceding = source.slice(Math.max(0, date.offset - NEAR), date.offset);
  return marks.some((mark) => {
    const word = mark.pattern.trim();
    if (word === "") return false;
    if (mark.position === "after") return followingPattern(word).test(following);
    if (mark.position === "before") return precedingPattern(word).test(preceding);
    return false;
  });
};
