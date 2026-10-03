import { exactRateOf, type OutputSize } from "./rates.ts";
import type { GradeScore } from "./result.ts";
import type { Rubric, RuleLimit } from "./rubric.ts";
import { counted, overLimit, verdictOf, type Graded, type Verdict } from "./verdict.ts";

// Pass or fail and the penalty score under a `grade:` rubric (spec §29.4). Only what the rubric writes decides: an error
// finding of a rule the rubric does not name is a rate, not a failure, so the reason for a failure is always in `grade:`.

/** What the rubric reads of one output beyond its findings, facts and citations. */
export type RubricInput = Graded & {
  readonly size: OutputSize;
  /** The required sections the output has no heading for. */
  readonly missingSections: readonly string[];
  /** The item gave sources but no citations. */
  readonly uncited: boolean;
};

const countOf = (input: RubricInput, rule: string): number => input.findings.filter((finding) => finding.rule === rule).length;

/** A rate as a failure reason shows it: to three decimals, enough to tell it from a limit written to one. */
const shownRate = (rate: number): string => String(Math.round(rate * RATE_SHOWN_SCALE) / RATE_SHOWN_SCALE);

const RATE_SHOWN_SCALE = 1000;

const ruleFailures = (input: RubricInput, rule: string, limit: RuleLimit): string[] => {
  const count = countOf(input, rule);
  const rate = exactRateOf(count, input.size.value);
  return [
    ...(limit.max === undefined ? [] : overLimit(`rules.${rule}`, count, limit.max)),
    ...(limit.maxRate === undefined || rate === undefined || rate <= limit.maxRate ? [] : [`rules.${rule}.rate ${shownRate(rate)} > ${String(limit.maxRate)}`]),
  ];
};

const sectionFailures = (input: RubricInput): string[] =>
  overLimit("required_sections.missing", input.missingSections.length, 0).map((reason) => `${reason}: ${input.missingSections.join(", ")}`);

const factFailures = (input: RubricInput, rubric: Rubric): string[] => {
  const limits = rubric.facts;
  if (limits === undefined || input.facts === null) return [];
  return [
    ...(limits.dropped === undefined ? [] : overLimit("facts.dropped", counted(input.facts.dropped), limits.dropped)),
    ...(limits.added === undefined ? [] : overLimit("facts.added", counted(input.facts.added), limits.added)),
  ];
};

const citationFailures = (input: RubricInput, rubric: Rubric): string[] => {
  const limits = rubric.citations;
  if (limits === undefined) return [];
  return [
    ...(limits.failed === undefined || input.citations === null ? [] : overLimit("citations.failed", input.citations.failed.length, limits.failed)),
    ...(limits.required && input.uncited ? ["citations.required: sources given, no citations"] : []),
  ];
};

const contextFailures = (input: RubricInput, rubric: Rubric): string[] => {
  const limits = rubric.contexts;
  if (limits === undefined) return [];
  return [
    ...(limits.unsupported === undefined || input.contexts === undefined
      ? []
      : overLimit("contexts.unsupported", counted(input.contexts.unsupported), limits.unsupported)),
    ...(limits.required && input.contexts === undefined ? ["contexts.required: no contexts given"] : []),
  ];
};

/** One item per finding of a weighted rule, so every point names the finding it came from; the penalty is their sum. */
export const scoreOf = (input: Pick<RubricInput, "findings">, rubric: Rubric): GradeScore => {
  const items = input.findings.flatMap((finding) => {
    const weight = rubric.rules[finding.rule]?.weight;
    return weight === undefined || weight === 0 ? [] : [{ points: weight, rule: finding.rule, line: finding.line }];
  });
  return { penalty: items.reduce((sum, item) => sum + item.points, 0), items };
};

export const rubricVerdict = (input: RubricInput, rubric: Rubric): { readonly verdict: Verdict; readonly score: GradeScore } => {
  const score = scoreOf(input, rubric);
  const failures = [
    ...Object.entries(rubric.rules).flatMap(([rule, limit]) => ruleFailures(input, rule, limit)),
    ...sectionFailures(input),
    ...factFailures(input, rubric),
    ...citationFailures(input, rubric),
    ...contextFailures(input, rubric),
    ...(rubric.penalty === undefined ? [] : overLimit("score.penalty", score.penalty, rubric.penalty)),
  ];
  return { verdict: verdictOf(failures), score };
};
