/**
 * 文書の仕事の期間（開講期間、Term）と、後ろの節の締め切りの日付を比べた結果。語の有無は呼ぶ側が読んで渡す。
 * 年の無い締め切りは、期間の始まりと終わりが同じ年のときだけその年と読む。年をまたぐ期間では、期間の外の月日は始まりの前とも終わりの後とも読める。
 */
export type TermDates = { readonly start: string; readonly end: string };

/** 締め切りの日付を囲む項目か文の語: 締め切りの語、期間の外に置く語、期間の後に来てよい仕事の語（成績発表、再試験）。 */
export type DeadlineMarks = { readonly deadline: boolean; readonly aside: boolean; readonly afterTerm: boolean };

export type DeadlineVerdict = "late" | "within" | "before" | "no-year" | "not-deadline" | "aside" | "after-term";

const YEAR_LENGTH = "2026".length;
const DATED = /^\d{4}-\d{2}-\d{2}$/u;
const MONTH_DAY = /^\d{2}-\d{2}$/u;

/** 締め切りの日付を年月日で。年が無ければ、期間の始まりと終わりの年が同じときだけその年を足す。 */
export const deadlineDate = (value: string, term: TermDates): string | undefined => {
  if (DATED.test(value)) return value;
  if (!MONTH_DAY.test(value) || !DATED.test(term.start) || !DATED.test(term.end)) return undefined;
  const year = term.start.slice(0, YEAR_LENGTH);
  return year === term.end.slice(0, YEAR_LENGTH) ? `${year}-${value}` : undefined;
};

const placeOf = (date: string, term: TermDates): DeadlineVerdict => {
  if (date > term.end) return "late";
  return date < term.start ? "before" : "within";
};

export const deadlineVerdict = (value: string, term: TermDates, marks: DeadlineMarks): DeadlineVerdict => {
  if (!marks.deadline) return "not-deadline";
  if (marks.afterTerm) return "after-term";
  if (marks.aside) return "aside";
  const date = deadlineDate(value, term);
  return date === undefined || !DATED.test(term.end) ? "no-year" : placeOf(date, term);
};
