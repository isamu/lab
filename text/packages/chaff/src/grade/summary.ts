import type { LengthUnit } from "../plugin.ts";
import { compareText, sortedByKey, tally } from "./order.ts";
import { rateOf } from "./rates.ts";
import type { GradeFact, GradeResult, NotRunEntry, Stamp } from "./result.ts";

// The summary of a run (spec §29.3), from the per-output results alone, so the same results always sum the same way.

/** Per length unit: Japanese outputs are measured in characters and English ones in words, and the two never add up. */
type PerUnit = Partial<Record<LengthUnit, number>>;

type RuleSummary = { readonly findings: number; readonly outputs: number; readonly rate: PerUnit };

export type GradeSummary = {
  readonly total: number;
  readonly passed: number;
  readonly failed: readonly { readonly id: string; readonly failedBecause: readonly string[] }[];
  readonly size: PerUnit;
  readonly rules: Readonly<Record<string, RuleSummary>>;
  readonly facts: { readonly dropped: Readonly<Record<string, number>>; readonly added: Readonly<Record<string, number>> };
  readonly citations: { readonly checked: number; readonly failed: number };
  readonly notRun: readonly (NotRunEntry & { readonly outputs: number })[];
  /** The penalty points of every output, added up. Only with a `grade:` rubric. */
  readonly penalty?: number | undefined;
  readonly stamp: Stamp | undefined;
};

const sizesOf = (results: readonly GradeResult[]): PerUnit =>
  results.reduce<PerUnit>((sizes, result) => ({ ...sizes, [result.size.unit]: (sizes[result.size.unit] ?? 0) + result.size.value }), {});

const countIn = (result: GradeResult, rule: string): number => result.findings.filter((finding) => finding.rule === rule).length;

/** A rule's findings over every output of one unit, per 1,000 of that unit. */
const ratePerUnit = (results: readonly GradeResult[], rule: string, sizes: PerUnit): PerUnit =>
  Object.fromEntries(
    Object.entries(sizes).flatMap(([unit, size]) => {
      const count = results.filter((result) => result.size.unit === unit).reduce((sum, result) => sum + countIn(result, rule), 0);
      const rate = count === 0 ? undefined : rateOf(count, size);
      return rate === undefined ? [] : [[unit, rate]];
    }),
  );

const rulesOf = (results: readonly GradeResult[], sizes: PerUnit): Record<string, RuleSummary> => {
  const ruleIds = [...new Set(results.flatMap((result) => result.findings.map((finding) => finding.rule)))];
  return sortedByKey(
    ruleIds.map((rule): [string, RuleSummary] => [
      rule,
      {
        findings: results.reduce((sum, result) => sum + countIn(result, rule), 0),
        outputs: results.filter((result) => countIn(result, rule) > 0).length,
        rate: ratePerUnit(results, rule, sizes),
      },
    ]),
  );
};

const kindsOf = (facts: readonly GradeFact[]): Record<string, number> => tally(facts.filter((fact) => !fact.allowed).map((fact) => fact.kind));

/** Each rule not run, with the reason, and how many outputs it did not run on. */
const notRunOf = (results: readonly GradeResult[]): GradeSummary["notRun"] => {
  const counts = new Map<string, { entry: NotRunEntry; outputs: number }>();
  results.forEach((result) =>
    result.notRun.forEach((entry) => {
      const key = `${entry.rule}\n${entry.reason}`;
      counts.set(key, { entry, outputs: (counts.get(key)?.outputs ?? 0) + 1 });
    }),
  );
  return [...counts.values()].map(({ entry, outputs }) => ({ ...entry, outputs })).toSorted((left, right) => compareText(left.rule, right.rule));
};

const penaltyOf = (results: readonly GradeResult[]): { readonly penalty?: number } => {
  const scored = results.flatMap((result) => (result.score === undefined ? [] : [result.score.penalty]));
  return scored.length === 0 ? {} : { penalty: scored.reduce((sum, points) => sum + points, 0) };
};

export const summaryOf = (results: readonly GradeResult[]): GradeSummary => {
  const sizes = sizesOf(results);
  return {
    total: results.length,
    passed: results.filter((result) => result.pass).length,
    failed: results.filter((result) => !result.pass).map((result) => ({ id: result.id, failedBecause: result.failedBecause })),
    size: sizes,
    rules: rulesOf(results, sizes),
    facts: {
      dropped: kindsOf(results.flatMap((result) => result.facts?.dropped ?? [])),
      added: kindsOf(results.flatMap((result) => result.facts?.added ?? [])),
    },
    citations: {
      checked: results.reduce((sum, result) => sum + (result.citations?.checked ?? 0), 0),
      failed: results.reduce((sum, result) => sum + (result.citations?.failed.length ?? 0), 0),
    },
    notRun: notRunOf(results),
    ...penaltyOf(results),
    stamp: results[0]?.stamp,
  };
};
