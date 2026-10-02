import type { LengthUnit } from "../plugin.ts";
import type { FeatureValue } from "../structure-shape/features.ts";
import type { Placement, StructureScore } from "../structure-shape/score.ts";
import type { StructureText } from "./structure-text.ts";

const BEYOND_MARK = "✗";
const WITHIN_MARK = "·";
const NOT_MEASURED = "—";

const valueText = (feature: FeatureValue, unit: LengthUnit, text: StructureText): string =>
  feature.value === undefined ? NOT_MEASURED : text.features[feature.id].value(feature.value, feature.detail, unit);

const whereText = (placement: Placement, text: StructureText): string => {
  if (placement.pastShare === undefined) return "";
  const low = placement.direction === "low";
  const where = text.past(placement.pastShare, low);
  if (!placement.beyond || placement.median === undefined || placement.limit === undefined) return `  ${where}`;
  return `  ${text.aside(where, text.human(String(placement.median), String(placement.limit), low))}`;
};

const placementLine = (placement: Placement, unit: LengthUnit, text: StructureText): string => {
  const mark = placement.beyond ? BEYOND_MARK : WITHIN_MARK;
  return `  ${mark} ${text.features[placement.feature.id].name}: ${valueText(placement.feature, unit, text)}${whereText(placement, text)}`;
};

const unmeasuredLine = (placements: readonly Placement[], text: StructureText): string[] => {
  const reasons = placements.flatMap((placement) => {
    const why = placement.feature.notMeasured;
    return why === undefined ? [] : [text.aside(text.features[placement.feature.id].name, text.notMeasured[why])];
  });
  return reasons.length === 0 ? [] : [`  ${text.unmeasured(reasons.join(text.listSeparator))}`];
};

const headerOf = (score: StructureScore, language: string, text: StructureText): string =>
  score.articles === undefined ? text.noBaseline(language) : text.score(score.score, score.compared, score.articles);

/** A value no higher (or, for a low measure, no more uniform) than any step of the human articles. */
const isUsual = (placement: Placement): boolean => placement.feature.value !== undefined && placement.pastShare === 0;

const usualLine = (placements: readonly Placement[], unit: LengthUnit, text: StructureText): string[] => {
  const usual = placements.filter(isUsual).map((placement) => `${text.features[placement.feature.id].name} ${valueText(placement.feature, unit, text)}`);
  return usual.length === 0 ? [] : [`  ${WITHIN_MARK} ${text.usualAmong(usual.join(text.listSeparator))}`];
};

/**
 * One document's structure block: the score, each value that stands out placed against human articles, the usual ones
 * on one line, then what was not measured and why.
 */
export const structureLines = (score: StructureScore, language: string, unit: LengthUnit, text: StructureText): string[] => [
  headerOf(score, language, text),
  ...score.placements
    .filter((placement) => placement.feature.value !== undefined && !isUsual(placement))
    .map((placement) => placementLine(placement, unit, text)),
  ...usualLine(score.placements, unit, text),
  ...unmeasuredLine(score.placements, text),
];

const changeLine = (before: Placement, after: Placement | undefined, units: readonly [LengthUnit, LengthUnit], text: StructureText): string => {
  const name = text.features[before.feature.id].name;
  const afterValue = after === undefined ? NOT_MEASURED : valueText(after.feature, units[1], text);
  return `  ${name}: ${valueText(before.feature, units[0], text)} → ${afterValue}`;
};

/** The score before and after, then each measure that either file measured. */
export const structureChangeLines = (
  before: StructureScore,
  after: StructureScore,
  units: readonly [LengthUnit, LengthUnit],
  text: StructureText,
): string[] => [
  `  ${text.scoreChange}: ${String(before.score)} → ${String(after.score)}`,
  ...before.placements.flatMap((placement, index) => {
    const other = after.placements[index];
    const measured = placement.feature.value !== undefined || other?.feature.value !== undefined;
    return measured ? [changeLine(placement, other, units, text)] : [];
  }),
];

/** For grep: the score and the measures past the human limit, on one line. */
export const structureCompact = (path: string, score: StructureScore): string => {
  const beyond = score.placements.filter((placement) => placement.beyond).map((placement) => `${placement.feature.id}=${String(placement.feature.value)}`);
  return [`${path}: structure ${String(score.score)}/${String(score.compared)}`, ...beyond].join(" ");
};

/** The structure block as data: the score, and each measure with its value, where it sits, and why it was not measured. */
export const structureJson = (score: StructureScore): Readonly<Record<string, unknown>> => ({
  score: score.score,
  compared: score.compared,
  baselineArticles: score.articles ?? null,
  features: score.placements.map((placement) => ({
    id: placement.feature.id,
    value: placement.feature.value ?? null,
    ...(placement.feature.detail === undefined ? {} : { detail: placement.feature.detail }),
    ...(placement.feature.notMeasured === undefined ? {} : { notMeasured: placement.feature.notMeasured }),
    direction: placement.direction,
    pastShare: placement.pastShare ?? null,
    humanMedian: placement.median ?? null,
    limit: placement.limit ?? null,
    beyond: placement.beyond,
  })),
});
