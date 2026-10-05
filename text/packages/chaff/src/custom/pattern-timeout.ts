// What a team's pattern may take, and what it is when it takes longer: the same wherever the pattern runs.

/** How long one rule's pattern may take over one document. Far above what a sane pattern needs on any real document. */
export const PATTERN_BUDGET_MS = 1000;

/** A pattern that did not finish within its budget. run.ts lists the rule as not run, with this as the reason. */
export class PatternTimeout extends Error {
  readonly budget_ms: number;
  constructor(budgetMs: number) {
    super(`the pattern did not finish within ${String(budgetMs)} ms`);
    this.name = "PatternTimeout";
    this.budget_ms = budgetMs;
  }
}

/** Each text's matches: where it starts and what it matched. Empty matches are left out. */
export type TextMatches = readonly (readonly { readonly index: number; readonly text: string }[])[];
