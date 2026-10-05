import type { LengthUnit } from "../plugin.ts";
import { BEYOND_STEP, type Placement, type StructureScore } from "../structure-shape/score.ts";
import { SAME_SHAPE } from "./signals.ts";

// The AI-likeness quick score: how many signs of generated text a document shows that human documents of its genre
// group rarely show. Pure: the signal counts, the human shares and the structure placement come in. It never says who
// wrote the text; it says how far the document is from human documents of its kind.

/** On how many human documents of one genre group a rule reported (corpus/rules-measure.json). */
export type GroupShare = { readonly documents: number; readonly fired: number };

/** Each AI-shape rule's human shares, by genre group. */
export type HumanShares = Readonly<Record<string, Readonly<Record<string, GroupShare>>>>;

const PERCENT = 100;

/**
 * A sign is unusual when at most this share of human documents shows it: the same line the structure measures draw at
 * the human p90 (BEYOND_STEP), so a phrase signal and a structure measure count by one rule.
 */
export const RARE_SHARE = (PERCENT - BEYOND_STEP) / PERCENT;

/** Below this many human documents a share moves in steps wider than RARE_SHARE: one document alone would be past it. */
export const MIN_BASELINE_DOCUMENTS = Math.ceil(1 / RARE_SHARE);

/** In unusual signs: ai-generated-composite's normal and relaxed levels, held to them by test_ai_score.ts. */
export const MEDIUM_SIGNS = 3;
export const HIGH_SIGNS = 5;

export type AiLevel = "low" | "medium" | "high";

/** One AI-shape rule's run on the document: how many findings it made, or why it did not run. */
export type SignalRun = { readonly rule: string; readonly count: number; readonly notRun?: string };

/** One signal set against human documents of the genre group. */
export type SignalPlace = SignalRun & {
  /** The human share for the group, or undefined when the group has none, or too few documents to compare with. */
  readonly human: GroupShare | undefined;
  /** It fired, and at most RARE_SHARE of human documents of the group show it: one sign. */
  readonly unusual: boolean;
};

/** One structure measure against human articles. sameAs: the rule that reads the same shape, when that rule already counts it. */
export type StructurePlace = Placement & { readonly sameAs: string | undefined };

export type NotScored =
  | { readonly reason: "too-short"; readonly length: number; readonly minimum: number; readonly unit: LengthUnit }
  | { readonly reason: "no-baseline"; readonly compared: number; readonly needed: number };

export type AiScore = {
  readonly group: string;
  /** undefined when the document is not scored: see notScored. */
  readonly level: AiLevel | undefined;
  readonly notScored: NotScored | undefined;
  /** The unusual signs: signals and structure measures past what most human documents of the group show. */
  readonly signs: number;
  /** How many signals and measures could be set against human documents at all. */
  readonly compared: number;
  readonly signals: readonly SignalPlace[];
  /** The structure measures against human articles, or undefined where they are not compared for the genre. */
  readonly structure: readonly StructurePlace[] | undefined;
};

/** What the score is computed from. structure: undefined where the structure baseline does not apply to the genre. */
export type ScoreInput = {
  readonly group: string;
  readonly length: number;
  readonly minimum: number;
  readonly unit: LengthUnit;
  readonly signals: readonly SignalRun[];
  readonly shares: HumanShares;
  readonly structure: StructureScore | undefined;
};

export const levelOf = (signs: number): AiLevel => {
  if (signs >= HIGH_SIGNS) return "high";
  return signs >= MEDIUM_SIGNS ? "medium" : "low";
};

const comparableShare = (share: GroupShare | undefined): GroupShare | undefined =>
  share !== undefined && share.documents >= MIN_BASELINE_DOCUMENTS ? share : undefined;

export const isRare = (share: GroupShare): boolean => share.fired / share.documents <= RARE_SHARE;

const placeSignal = (run: SignalRun, shares: HumanShares, group: string): SignalPlace => {
  const human = run.notRun === undefined ? comparableShare(shares[run.rule]?.[group]) : undefined;
  return { ...run, human, unusual: human !== undefined && run.count > 0 && isRare(human) };
};

const notScoredOf = (input: ScoreInput, compared: number): NotScored | undefined => {
  if (input.length < input.minimum) return { reason: "too-short", length: input.length, minimum: input.minimum, unit: input.unit };
  // Fewer comparable signs than the high boundary could never read high: a low there would only mean "not looked at".
  return compared < HIGH_SIGNS ? { reason: "no-baseline", compared, needed: HIGH_SIGNS } : undefined;
};

const placeStructure = (placement: Placement, signals: readonly SignalPlace[]): StructurePlace => {
  const twin = signals.find((signal) => signal.rule === SAME_SHAPE[placement.feature.id]);
  return { ...placement, sameAs: placement.beyond && twin?.unusual === true ? twin.rule : undefined };
};

const comparedTwice = (placement: Placement, signals: readonly SignalPlace[]): boolean =>
  placement.pastShare !== undefined && signals.some((signal) => signal.rule === SAME_SHAPE[placement.feature.id] && signal.human !== undefined);

/** The quick score of one document: its unusual signs against human documents of its genre group, and the level they reach. */
export const aiScoreOf = (input: ScoreInput): AiScore => {
  const signals = input.signals.map((run) => placeSignal(run, input.shares, input.group));
  const placements = input.structure?.placements.map((placement) => placeStructure(placement, signals));
  const measures = placements ?? [];
  const signs = signals.filter((signal) => signal.unusual).length + measures.filter((place) => place.beyond && place.sameAs === undefined).length;
  const compared =
    signals.filter((signal) => signal.human !== undefined).length +
    measures.filter((place) => place.pastShare !== undefined && !comparedTwice(place, signals)).length;
  const notScored = notScoredOf(input, compared);
  return { group: input.group, level: notScored === undefined ? levelOf(signs) : undefined, notScored, signs, compared, signals, structure: placements };
};
