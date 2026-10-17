/**
 * How far a dimension's score can be trusted, from two independent signals: suppressions dense
 * enough that the other probes saw less than the code holds (spec §15.4), and probes that could not
 * run, so part of the weight was never measured. The lower of the two decides.
 *
 * A probe skipped because it does not apply — no UI files, a JavaScript project — lowers nothing:
 * there was nothing there to measure, and the score is complete without it.
 */

export type Confidence = "high" | "medium" | "low";

const SUPPRESSIONS_MEDIUM_PER_KLOC = 0.5;
const SUPPRESSIONS_LOW_PER_KLOC = 2.0;
/** Half the weight unmeasured leaves a score that is mostly the rubric's renormalisation, not the code. */
const UNRUN_LOW_SHARE = 0.5;

export interface UnrunProbe {
  readonly probe: string;
  readonly reason: string;
  /** Rubric weight of this dimension's metrics the probe would have supplied. */
  readonly weight: number;
}

export interface ConfidenceInput {
  /** undefined when the rubric wires no suppression signal. */
  readonly suppressionsPerKloc: number | undefined;
  readonly suppressionCount: number;
  readonly totalWeight: number;
  readonly unrun: readonly UnrunProbe[];
}

export interface ConfidenceVerdict {
  readonly confidence: Confidence;
  readonly reason: string;
}

const RANK: Readonly<Record<Confidence, number>> = { high: 2, medium: 1, low: 0 };

const suppressionLevel = (perKloc: number | undefined): Confidence => {
  if (perKloc === undefined || perKloc < SUPPRESSIONS_MEDIUM_PER_KLOC) return "high";
  return perKloc < SUPPRESSIONS_LOW_PER_KLOC ? "medium" : "low";
};

const unrunShare = (input: ConfidenceInput): number =>
  input.totalWeight <= 0 ? 0 : input.unrun.reduce((sum, entry) => sum + entry.weight, 0) / input.totalWeight;

const unrunLevel = (input: ConfidenceInput): Confidence => {
  const share = unrunShare(input);
  if (share <= 0) return "high";
  return share < UNRUN_LOW_SHARE ? "medium" : "low";
};

const suppressionReason = (input: ConfidenceInput): string =>
  input.suppressionsPerKloc === undefined ? "no suppression signal wired" : `${input.suppressionCount} suppressions in scope`;

const describeUnrun = (entry: UnrunProbe): string => `${entry.probe} (${entry.reason})`;

const unrunReason = (unrun: readonly UnrunProbe[]): string => ["not run:", unrun.map(describeUnrun).join(", ")].join(" ");

export const judgeConfidence = (input: ConfidenceInput): ConfidenceVerdict => {
  const bySuppression = suppressionLevel(input.suppressionsPerKloc);
  const byUnrun = unrunLevel(input);
  const confidence = RANK[byUnrun] < RANK[bySuppression] ? byUnrun : bySuppression;
  const reasons = [
    ...(bySuppression === confidence ? [suppressionReason(input)] : []),
    ...(byUnrun === confidence && confidence !== "high" ? [unrunReason(input.unrun)] : []),
  ];
  return { confidence, reason: reasons.join("; ") };
};
