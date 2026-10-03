import type { LengthUnit } from "../plugin.ts";
import { rateRows, sameReading } from "./pairing.ts";
import type { GradeResult } from "./result.ts";
import { summaryOf } from "./summary.ts";
import { variantGroupsOf, type VariantGroups } from "./variants-input.ts";

// Several variants (prompts, models, settings) graded on the same inputs, side by side (spec §29.5). Pure. Outputs are
// matched by id: only an id every variant answered, read the same way, is compared, so each column covers the same tasks.

/** One variant over the compared ids. */
export type VariantColumn = {
  readonly variant: string;
  readonly outputs: number;
  readonly passed: number;
  /** The share of outputs that passed, in percent to one decimal. Undefined when no id was compared. */
  readonly passRate?: number | undefined;
  /** Facts dropped and added against the reference, not counting the kinds the rubric allows. */
  readonly facts: { readonly dropped: number; readonly added: number };
  readonly citations: { readonly checked: number; readonly failed: number };
  /** Only with a `grade:` rubric. */
  readonly penalty?: number | undefined;
};

/** One rule's rate per 1,000 units in each variant, by variant label; 0 where the variant had no finding of it. */
export type VariantRates = { readonly rule: string; readonly unit: LengthUnit; readonly rates: Readonly<Record<string, number>> };

/** An id some variants passed and others failed, with why each failed. */
export type Disagreement = {
  readonly id: string;
  readonly passedIn: readonly string[];
  readonly failedIn: readonly { readonly variant: string; readonly failedBecause: readonly string[] }[];
};

export type VariantComparison = {
  /** In the order they first appear. */
  readonly variants: readonly string[];
  /** The ids every variant answered, read the same way. */
  readonly compared: readonly string[];
  /** Ids some variant did not answer, and which. */
  readonly missing: readonly { readonly id: string; readonly missingFrom: readonly string[] }[];
  /** Ids every variant answered, but in another language or genre: not the same task graded the same way. */
  readonly readOtherwise: readonly string[];
  readonly columns: readonly VariantColumn[];
  readonly rules: readonly VariantRates[];
  readonly disagreements: readonly Disagreement[];
};

const PERCENT = 100;
const PERCENT_SCALE = 10;

const percentOf = (passed: number, outputs: number): number | undefined =>
  outputs === 0 ? undefined : Math.round((passed * PERCENT * PERCENT_SCALE) / outputs) / PERCENT_SCALE;

const sum = (counts: Readonly<Record<string, number>>): number => Object.values(counts).reduce((total, count) => total + count, 0);

const columnOf = (variant: string, results: readonly GradeResult[]): VariantColumn => {
  const summary = summaryOf(results);
  return {
    variant,
    outputs: summary.total,
    passed: summary.passed,
    passRate: percentOf(summary.passed, summary.total),
    facts: { dropped: sum(summary.facts.dropped), added: sum(summary.facts.added) },
    citations: summary.citations,
    ...(summary.penalty === undefined ? {} : { penalty: summary.penalty }),
  };
};

const disagreementOf = (id: string, row: readonly GradeResult[], variants: readonly string[]): Disagreement[] => {
  const passedIn = variants.filter((_, index) => row[index]?.pass === true);
  if (passedIn.length === 0 || passedIn.length === variants.length) return [];
  const failedIn = variants.flatMap((variant, index) => {
    const result = row[index];
    return result === undefined || result.pass ? [] : [{ variant, failedBecause: result.failedBecause }];
  });
  return [{ id, passedIn, failedIn }];
};

/** Each id in order of first appearance, with its result in each variant, or undefined where the variant has none. */
const rowsOf = (grouped: VariantGroups, variants: readonly string[]): { readonly id: string; readonly row: readonly (GradeResult | undefined)[] }[] => {
  const ids = [...new Set([...grouped.values()].flatMap((byId) => [...byId.keys()]))];
  return ids.map((id) => ({ id, row: variants.map((variant) => grouped.get(variant)?.get(id)) }));
};

const isComplete = (row: readonly (GradeResult | undefined)[]): row is readonly GradeResult[] => row.every((result) => result !== undefined);

/** The variants side by side over the ids they all answered. `grouped`: each variant's results by id, the variants in order. */
export const compareVariantGroups = (grouped: VariantGroups): VariantComparison => {
  const variants = [...grouped.keys()];
  const rows = rowsOf(grouped, variants);
  const complete = rows.flatMap(({ id, row }) => (isComplete(row) ? [{ id, row }] : []));
  const compared = complete.filter(({ row }) => sameReading(row));
  const byVariant = variants.map((_, index) => compared.flatMap(({ row }) => row.slice(index, index + 1)));
  return {
    variants,
    compared: compared.map(({ id }) => id),
    missing: rows.flatMap(({ id, row }) => {
      const missingFrom = variants.filter((_, index) => row[index] === undefined);
      return missingFrom.length === 0 ? [] : [{ id, missingFrom }];
    }),
    readOtherwise: complete.filter(({ row }) => !sameReading(row)).map(({ id }) => id),
    columns: variants.map((variant, index) => columnOf(variant, byVariant[index] ?? [])),
    rules: rateRows(byVariant)
      .filter((row) => row.rates.some((rate) => rate > 0))
      .map(({ rule, unit, rates }) => ({ rule, unit, rates: Object.fromEntries(variants.map((variant, index) => [variant, rates[index] ?? 0])) })),
    disagreements: compared.flatMap(({ id, row }) => disagreementOf(id, row, variants)),
  };
};

/** A run's results compared variant by variant, or undefined when none has a variant label (the command line's input already checked). */
export const variantsOfRun = (results: readonly GradeResult[]): VariantComparison | undefined => {
  if (!results.some((result) => result.variant !== undefined)) return undefined;
  const read = variantGroupsOf(results);
  return "groups" in read ? compareVariantGroups(read.groups) : undefined;
};
