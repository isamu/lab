// interest-mismatch: the reading half. Reads the document's lines outside tables and the lexicon interest-label, and
// leaves the deciding to structure/interest.ts.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { quoteAt } from "./structure-tree.ts";
import { linesOf } from "../structure/lines.ts";
import { TABLE_ROW } from "../structure/runs.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { interestMismatches, type InterestPeriod, type InterestRole, type InterestWords, type PeriodWord } from "../structure/interest.ts";

const RULE = "interest-mismatch";
const ROLES: readonly string[] = ["interest", "base", "rate", "net"] satisfies readonly InterestRole[];
const isRole = (group: string | undefined): group is InterestRole => group !== undefined && ROLES.includes(group);
/** group rate-year: a rate for a year (年利, APR); interest-month: interest for a month (当月, for the month). */
const PERIOD_GROUP = /^(rate|interest)-(year|month)$/u;

const periodOf = (pattern: string, group: string | undefined): PeriodWord[] => {
  const match = PERIOD_GROUP.exec(group ?? "");
  const [of, period] = [match?.[1], match?.[2]];
  return (of === "rate" || of === "interest") && (period === "year" || period === "month") ? [{ pattern, of, period: period satisfies InterestPeriod }] : [];
};

/** Lexicon interest-label: the words of the interest, the balance, the rate and after-tax interest, and the period words. */
const interestWordsOf = (doc: ProseDocument): InterestWords => {
  const entries = doc.lexicons["interest-label"] ?? [];
  return {
    labels: entries.flatMap((entry) => (isRole(entry.group) ? [{ pattern: entry.pattern, role: entry.group }] : [])),
    periods: entries.flatMap((entry) => periodOf(entry.pattern, entry.group)),
  };
};

export const interest: Detector = (doc): Finding[] => {
  const words = interestWordsOf(doc);
  if (words.labels.length === 0) return [];
  const lines = linesOf(proseAndTablesOf(doc)).filter((line) => !TABLE_ROW.test(line.text) && line.text.trim() !== "");
  return interestMismatches(lines, words).map((issue) => ({
    rule: RULE,
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
