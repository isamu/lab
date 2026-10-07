import { shownSignsOf, type AiLevel, type AiScore, type NotScored } from "../ai-score/score.ts";

// The AI-likeness quick score as one output's result carries it, and its levels counted over many outputs. Pure.

/** One output's quick score: its level (null when not scored, and why), the signs, and which showed. */
export type GradeAiScore = {
  readonly level: AiLevel | null;
  readonly notScored: NotScored["reason"] | null;
  readonly signs: number;
  readonly compared: number;
  /** The signs that counted: rule ids, structure measures as structure:<id>, and ai-generated-composite:strict. */
  readonly shown: readonly string[];
};

/** How many outputs reached each level, and how many were not scored. */
export type AiLevelCounts = Readonly<Record<AiLevel | "notScored", number>>;

export const gradeAiScoreOf = (score: AiScore): GradeAiScore => ({
  level: score.level ?? null,
  notScored: score.notScored?.reason ?? null,
  signs: score.signs,
  compared: score.compared,
  shown: shownSignsOf(score),
});

/** The levels of the outputs that carry a score, or undefined when none does (results written before the score existed). */
export const aiLevelCountsOf = (scores: readonly (GradeAiScore | undefined)[]): AiLevelCounts | undefined => {
  const scored = scores.filter((score) => score !== undefined);
  if (scored.length === 0) return undefined;
  const count = (level: AiLevel): number => scored.filter((score) => score.level === level).length;
  return { low: count("low"), medium: count("medium"), high: count("high"), notScored: scored.filter((score) => score.level === null).length };
};
