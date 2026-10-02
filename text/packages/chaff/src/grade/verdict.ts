import type { GradeFact, GradeResult } from "./result.ts";

/** What pass or fail is decided from. */
export type Graded = Pick<GradeResult, "findings" | "facts" | "citations">;

export type Verdict = { readonly pass: boolean; readonly failedBecause: readonly string[] };

/** A condition over a count, written as the reason when the count goes past its limit: `facts.dropped 3 > 0`. */
export const overLimit = (name: string, count: number, limit: number): string[] => (count > limit ? [`${name} ${String(count)} > ${String(limit)}`] : []);

/** Facts that count against the output: those whose kind was not allowed to change. */
export const counted = (facts: readonly GradeFact[]): number => facts.filter((fact) => !fact.allowed).length;

export const verdictOf = (failedBecause: readonly string[]): Verdict => ({ pass: failedBecause.length === 0, failedBecause });

/**
 * The pass or fail with no `grade:` in chaff.yaml (spec §29.3): an error finding, a fact dropped or added against the
 * reference, or a quotation not found fails the output. Warnings and info are rates to compare, not a verdict on one output.
 */
export const defaultVerdict = (graded: Graded): Verdict =>
  verdictOf([
    ...overLimit("findings.error", graded.findings.filter((finding) => finding.level === "error").length, 0),
    ...overLimit("facts.dropped", counted(graded.facts?.dropped ?? []), 0),
    ...overLimit("facts.added", counted(graded.facts?.added ?? []), 0),
    ...overLimit("citations.failed", graded.citations?.failed.length ?? 0, 0),
  ]);
