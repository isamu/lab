import type { GradeResult } from "./result.ts";
import { isGradeResult } from "./results-read.ts";

// The results `compareVariants()` is given, checked and grouped by variant. Pure. A harness builds this input by hand, so
// a result without an id, without a variant or under an id its variant already has is said, not silently dropped.

/** Each variant's results, by variant label then id, in order of first appearance. */
export type VariantGroups = ReadonlyMap<string, ReadonlyMap<string, GradeResult>>;

/** Labelled results, or each variant's results under its label. */
export type VariantInput = readonly GradeResult[] | Readonly<Record<string, readonly GradeResult[]>>;

type Labelled = { readonly variant: unknown; readonly result: unknown; readonly place: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const labelledOf = (input: unknown): Labelled[] | undefined => {
  if (Array.isArray(input))
    return input.map((result: unknown, index) => ({ variant: isRecord(result) ? result["variant"] : undefined, result, place: `results[${String(index)}]` }));
  if (!isRecord(input)) return undefined;
  return Object.entries(input).flatMap(([variant, results]) =>
    Array.isArray(results)
      ? results.map((result: unknown, index) => ({ variant, result, place: `${variant}[${String(index)}]` }))
      : [{ variant, result: results, place: variant }],
  );
};

/** A whole result line, as `--out` writes it, with an id to match by: a partial object would break the table, not be compared. */
const isResult = (value: unknown): value is GradeResult => isGradeResult(value) && value.id !== "";

/** Why one entry cannot be compared, or undefined when it can. */
const problemOf = (entry: Labelled, groups: ReadonlyMap<string, ReadonlyMap<string, GradeResult>>): string | undefined => {
  if (!isResult(entry.result)) return `${entry.place}: not a grade result with an id`;
  if (typeof entry.variant !== "string" || entry.variant === "") return `${entry.place}: id "${entry.result.id}" has no variant`;
  return groups.get(entry.variant)?.has(entry.result.id) === true
    ? `${entry.place}: id "${entry.result.id}" is already in variant "${entry.variant}"`
    : undefined;
};

/** The results grouped by variant, or every reason some cannot be. No result at all is a problem, not an empty comparison. */
export const variantGroupsOf = (input: unknown): { readonly groups: VariantGroups } | { readonly problems: readonly string[] } => {
  const labelled = labelledOf(input);
  if (labelled === undefined) return { problems: ["results must be an array of grade results, or { variant: results[] }"] };
  const groups = new Map<string, Map<string, GradeResult>>();
  const problems = labelled.flatMap((entry) => {
    const problem = problemOf(entry, groups);
    if (problem !== undefined || !isResult(entry.result) || typeof entry.variant !== "string") return problem === undefined ? [] : [problem];
    const byId = groups.get(entry.variant) ?? new Map<string, GradeResult>();
    groups.set(entry.variant, byId.set(entry.result.id, { ...entry.result, variant: entry.variant }));
    return [];
  });
  if (problems.length > 0) return { problems };
  return groups.size === 0 ? { problems: ["no results to compare"] } : { groups };
};
