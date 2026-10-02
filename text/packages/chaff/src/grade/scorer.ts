import { tally } from "./order.ts";
import type { GradeResult } from "./result.ts";

// The common scorer shape of eval frameworks (promptfoo, autoevals, evalite, DeepEval, Inspect AI…) as a projection of
// one result: a score, pass, a reason a person can read, and the whole breakdown as metadata. Spec §29.6.

export type ChaffScore = {
  readonly name: "chaff";
  /** 1 when the output passed, 0 when it failed. Never the penalty mapped onto 0–1: chaff sets no full marks (§29.4). */
  readonly score: 0 | 1;
  readonly pass: boolean;
  readonly reason: string;
  readonly metadata: Omit<GradeResult, "pass">;
};

const findingsWord = (count: number): string => (count === 1 ? "finding" : "findings");

/** The findings in one phrase: "3 findings: closing-cliche ×2, ai-tell ×1". */
const findingsPhrase = (result: GradeResult): string => {
  const counts = Object.entries(tally(result.findings.map((finding) => finding.rule))).map(([rule, count]) => `${rule} ×${String(count)}`);
  return counts.length === 0 ? "no findings" : `${String(result.findings.length)} ${findingsWord(result.findings.length)}: ${counts.join(", ")}`;
};

const penaltyPhrase = (result: GradeResult): string[] => (result.score === undefined ? [] : [`penalty ${String(result.score.penalty)}`]);

/** Why it passed or failed, then what was found: the failed conditions first, since they decide the score. */
export const reasonOf = (result: GradeResult): string =>
  [result.pass ? "passed" : `failed: ${result.failedBecause.join("; ")}`, findingsPhrase(result), ...penaltyPhrase(result)].join(" — ");

export const toScorer = (result: GradeResult): ChaffScore => {
  const { pass, ...rest } = result;
  return { name: "chaff", score: pass ? 1 : 0, pass, reason: reasonOf(result), metadata: rest };
};
