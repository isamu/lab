import type { LengthUnit } from "../plugin.ts";
import { compareText, tally } from "./order.ts";
import type { FailedCitation, GradeFact, GradeResult, Stamp } from "./result.ts";
import { summaryOf } from "./summary.ts";

// A run compared with an earlier one (spec §29.5). Pure. Outputs are paired by id; a pair is compared only when both
// were read the same way (language and genre), and the runs only when their stamps say the same rules and settings.

/** How a rule's rate moved over the paired outputs of one unit, and which outputs gained or lost findings of it. */
export type RuleMovement = {
  readonly rule: string;
  readonly unit: LengthUnit;
  readonly before: number;
  readonly after: number;
  readonly increasedIn: readonly string[];
  readonly decreasedIn: readonly string[];
  /** Named under the rubric's rules: only these count as a regression when they increase. */
  readonly inRubric: boolean;
};

/** What an output newly dropped or added, or newly failed to quote, against the same reference and sources. */
export type ItemChange = {
  readonly id: string;
  readonly dropped: readonly GradeFact[];
  readonly added: readonly GradeFact[];
  readonly citations: readonly FailedCitation[];
};

export type Comparison = {
  readonly paired: number;
  readonly onlyBefore: readonly string[];
  readonly onlyAfter: readonly string[];
  /** Paired by id but read in another language or genre: not the same task graded the same way. */
  readonly readOtherwise: readonly string[];
  readonly rules: readonly RuleMovement[];
  readonly newlyFailed: readonly string[];
  readonly newlyPassed: readonly string[];
  readonly items: readonly ItemChange[];
  readonly penalty?: { readonly before: number; readonly after: number } | undefined;
  /** Each reason this is a regression; empty when it is none. */
  readonly regressions: readonly string[];
};

/** Why two runs cannot be compared: their rules or settings differ, or the baseline mixes several stamps. */
export type StampCheck = { readonly comparable: true } | { readonly comparable: false; readonly differ: readonly ("rules" | "settings" | "mixed")[] };

const STAMP_PARTS: readonly ("rules" | "settings")[] = ["rules", "settings"];

export const stampCheck = (before: readonly GradeResult[], current: Stamp): StampCheck => {
  const stamps = new Set(before.map((result) => `${result.stamp.rules}\n${result.stamp.settings}`));
  const [first] = before;
  if (stamps.size > 1 || first === undefined) return { comparable: false, differ: ["mixed"] };
  const differ = STAMP_PARTS.filter((part) => first.stamp[part] !== current[part]);
  return differ.length === 0 ? { comparable: true } : { comparable: false, differ };
};

type Pair = { readonly before: GradeResult; readonly after: GradeResult };

const countIn = (result: GradeResult, rule: string): number => result.findings.filter((finding) => finding.rule === rule).length;

const movementsOf = (pairs: readonly Pair[], rubricRules: ReadonlySet<string>): RuleMovement[] => {
  const before = summaryOf(pairs.map((pair) => pair.before)).rules;
  const after = summaryOf(pairs.map((pair) => pair.after)).rules;
  const rules = [...new Set([...Object.keys(before), ...Object.keys(after)])].toSorted(compareText);
  const units = [...new Set(pairs.map((pair) => pair.after.size.unit))].toSorted(compareText);
  return rules.flatMap((rule) =>
    units.flatMap((unit) => {
      const inUnit = pairs.filter((pair) => pair.after.size.unit === unit);
      const increasedIn = inUnit.filter((pair) => countIn(pair.after, rule) > countIn(pair.before, rule)).map((pair) => pair.after.id);
      const decreasedIn = inUnit.filter((pair) => countIn(pair.after, rule) < countIn(pair.before, rule)).map((pair) => pair.after.id);
      const rates = { before: before[rule]?.rate[unit] ?? 0, after: after[rule]?.rate[unit] ?? 0 };
      if (increasedIn.length === 0 && decreasedIn.length === 0 && rates.before === rates.after) return [];
      return [{ rule, unit, ...rates, increasedIn, decreasedIn, inRubric: rubricRules.has(rule) }];
    }),
  );
};

const factKey = (fact: GradeFact): string => `${fact.kind}\n${fact.key}`;

/** The facts of `after` beyond as many as `before` had of each: a fact dropped in both runs is not new. */
const newFacts = (before: readonly GradeFact[], after: readonly GradeFact[]): GradeFact[] => {
  const earlier = tally(before.filter((fact) => !fact.allowed).map(factKey));
  const seen = new Map<string, number>();
  return after
    .filter((fact) => !fact.allowed)
    .filter((fact) => {
      const key = factKey(fact);
      seen.set(key, (seen.get(key) ?? 0) + 1);
      return (seen.get(key) ?? 0) > (earlier[key] ?? 0);
    });
};

const citationKey = (citation: FailedCitation): string => `${citation.source}\n${citation.address}\n${citation.quote}`;

const itemChange = ({ before, after }: Pair): ItemChange => {
  const failedBefore = new Set((before.citations?.failed ?? []).map(citationKey));
  return {
    id: after.id,
    dropped: newFacts(before.facts?.dropped ?? [], after.facts?.dropped ?? []),
    added: newFacts(before.facts?.added ?? [], after.facts?.added ?? []),
    citations: (after.citations?.failed ?? []).filter((citation) => !failedBefore.has(citationKey(citation))),
  };
};

const penaltyOf = (results: readonly GradeResult[]): number => results.reduce((sum, result) => sum + (result.score?.penalty ?? 0), 0);

const scored = (pairs: readonly Pair[]): boolean => pairs.some((pair) => pair.after.score !== undefined);

const regressionsOf = (newlyFailed: readonly string[], movements: readonly RuleMovement[], penalty: Comparison["penalty"]): string[] => [
  ...newlyFailed.map((id) => `${id}: passed, now fails`),
  ...movements
    .filter((movement) => movement.inRubric && movement.increasedIn.length > 0)
    .map((movement) => `rules.${movement.rule}: more findings in ${movement.increasedIn.join(", ")}`),
  ...(penalty !== undefined && penalty.after > penalty.before ? [`score.penalty ${String(penalty.before)} → ${String(penalty.after)}`] : []),
];

const sameReading = (pair: Pair): boolean => pair.before.language === pair.after.language && pair.before.genre === pair.after.genre;

/** `after` compared with `before`, output by output. `rubricRules`: the rules the rubric names, whose increase is a regression. */
export const compareRuns = (before: readonly GradeResult[], after: readonly GradeResult[], rubricRules: ReadonlySet<string>): Comparison => {
  const earlier = new Map(before.map((result) => [result.id, result]));
  const ids = new Set(after.map((result) => result.id));
  const matched = after.flatMap((result) => {
    const match = earlier.get(result.id);
    return match === undefined ? [] : [{ before: match, after: result }];
  });
  const pairs = matched.filter(sameReading);
  const rules = movementsOf(pairs, rubricRules);
  const newlyFailed = pairs.filter((pair) => pair.before.pass && !pair.after.pass).map((pair) => pair.after.id);
  const penalty = scored(pairs) ? { before: penaltyOf(pairs.map((pair) => pair.before)), after: penaltyOf(pairs.map((pair) => pair.after)) } : undefined;
  return {
    paired: pairs.length,
    onlyBefore: before.filter((result) => !ids.has(result.id)).map((result) => result.id),
    onlyAfter: after.filter((result) => !earlier.has(result.id)).map((result) => result.id),
    readOtherwise: matched.filter((pair) => !sameReading(pair)).map((pair) => pair.after.id),
    rules,
    newlyFailed,
    newlyPassed: pairs.filter((pair) => !pair.before.pass && pair.after.pass).map((pair) => pair.after.id),
    items: pairs.map(itemChange).filter((change) => change.dropped.length + change.added.length + change.citations.length > 0),
    ...(penalty === undefined ? {} : { penalty }),
    regressions: regressionsOf(newlyFailed, rules, penalty),
  };
};
