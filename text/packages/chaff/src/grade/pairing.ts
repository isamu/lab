import type { LengthUnit } from "../plugin.ts";
import { compareText } from "./order.ts";
import type { GradeResult } from "./result.ts";
import { summaryOf } from "./summary.ts";

// What --baseline (two runs over time) and the variant comparison (several prompts or models on one run) share: outputs
// matched by id within a variant, read the same way, and each rule's rate per group over the matched outputs. Pure.

/** Read in one language and genre: otherwise not the same task graded the same way. */
export const sameReading = (results: readonly GradeResult[]): boolean =>
  results.every((result) => result.language === results[0]?.language && result.genre === results[0]?.genre);

/** One rule's rate per 1,000 units of one unit, in each group, in the order the groups were given. 0 where it had none. */
export type RateRow = { readonly rule: string; readonly unit: LengthUnit; readonly rates: readonly number[] };

/** Each rule's rate in each group, per unit. `groups` hold the same tasks, so the rates compare like with like. */
export const rateRows = (groups: readonly (readonly GradeResult[])[]): RateRow[] => {
  const summaries = groups.map((group) => summaryOf(group).rules);
  const rules = [...new Set(summaries.flatMap((rules) => Object.keys(rules)))].toSorted(compareText);
  const units = [...new Set(groups.flatMap((group) => group.map((result) => result.size.unit)))].toSorted(compareText);
  return rules.flatMap((rule) => units.map((unit) => ({ rule, unit, rates: summaries.map((rules) => rules[rule]?.rate[unit] ?? 0) })));
};
