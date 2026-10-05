import type { LengthUnit, Localized } from "../plugin.ts";
import { localized } from "../render/text.ts";
import type { StructureText } from "../outline/structure-text.ts";
import { HIGH_SIGNS, MEDIUM_SIGNS, shownSignsOf, type AiScore, type NotScored, type SignalPlace, type StructurePlace } from "./score.ts";
import type { AiScoreText } from "./text.ts";

/** What a rendering needs besides the score: the texts, the rules' names, and the genre group's name, in one language. */
export type ScoreView = {
  readonly text: AiScoreText;
  readonly structure: StructureText;
  readonly language: string;
  readonly unit: LengthUnit;
  readonly groupName: string;
  readonly ruleNames: Readonly<Record<string, Localized>>;
};

const nameOf = (rule: string, view: ScoreView): string => {
  const name = view.ruleNames[rule];
  return name === undefined ? rule : localized(name, view.language);
};

const notScoredText = (notScored: NotScored, view: ScoreView): string =>
  notScored.reason === "too-short"
    ? view.text.tooShort(notScored.length, notScored.minimum, notScored.unit)
    : view.text.noBaseline(view.groupName, notScored.compared, notScored.needed);

/** The level line, or why there is none. */
export const aiScoreHeadline = (score: AiScore, view: ScoreView): string => {
  if (score.level !== undefined) return view.text.headline(score.level, view.groupName);
  return view.text.summaryNotScored(score.notScored === undefined ? "" : notScoredText(score.notScored, view));
};

/** The one line the lint report ends a file with. */
export const aiScoreSummaryLine = (score: AiScore, path: string, view: ScoreView): string =>
  score.level === undefined ? aiScoreHeadline(score, view) : view.text.summary(aiScoreHeadline(score, view), score.signs, path);

const signalLine = (signal: SignalPlace, view: ScoreView): string => {
  const { human } = signal;
  if (human === undefined) return "";
  const name = nameOf(signal.rule, view);
  return signal.unusual
    ? view.text.fired(name, signal.count, human.fired, human.documents, view.groupName)
    : view.text.common(name, signal.count, human.fired, human.documents);
};

const namesLine = (names: readonly string[], line: (names: string) => string, view: ScoreView): string[] =>
  names.length === 0 ? [] : [`  ${line(names.join(view.text.listSeparator))}`];

const signalLines = (signals: readonly SignalPlace[], view: ScoreView): string[] => {
  const compared = signals.filter((signal) => signal.human !== undefined);
  const shown = compared.filter((signal) => signal.count > 0);
  const quiet = compared.length - shown.length;
  const unshared = signals.filter((signal) => signal.human === undefined && signal.notRun === undefined).map((signal) => nameOf(signal.rule, view));
  const notRun = signals.flatMap((signal) => (signal.notRun === undefined ? [] : [view.text.aside(nameOf(signal.rule, view), signal.notRun)]));
  return [
    view.text.signalsHeading,
    ...shown.map((signal) => `  ${signalLine(signal, view)}`),
    ...(quiet > 0 ? [`  ${view.text.quiet(quiet)}`] : []),
    ...namesLine(unshared, view.text.noHumanShare, view),
    ...namesLine(notRun, view.text.notRun, view),
  ];
};

const placeLine = (place: StructurePlace, view: ScoreView): string => {
  const name = view.structure.features[place.feature.id].name;
  const value = place.feature.value === undefined ? "" : view.structure.features[place.feature.id].value(place.feature.value, place.feature.detail, view.unit);
  const where = view.structure.past(place.pastShare ?? 0, place.direction === "low");
  const line = `✗ ${name}: ${value}  ${where}`;
  return place.sameAs === undefined ? line : view.text.aside(line, view.text.sameAs(nameOf(place.sameAs, view)));
};

const structureBlock = (score: AiScore, view: ScoreView): string[] => {
  if (score.structure === undefined) return [view.text.structureNotCompared(view.groupName)];
  const beyond = score.structure.filter((place) => place.beyond);
  const usual = score.structure.filter((place) => !place.beyond && place.pastShare !== undefined).length;
  return [view.text.structureHeading, ...beyond.map((place) => `  ${placeLine(place, view)}`), ...(usual > 0 ? [`  ${view.text.usual(usual)}`] : [])];
};

/** For a person: the level, the signs, each signal and structure measure that showed, and what was not compared and why. */
export const renderAiScoreFriendly = (path: string, score: AiScore, view: ScoreView): string[] => {
  const head = [path, aiScoreHeadline(score, view)];
  if (score.notScored !== undefined) return head;
  return [
    ...head,
    `  ${view.text.signs(score.signs, score.compared, MEDIUM_SIGNS, HIGH_SIGNS)}`,
    `  ${view.text.disclaimer}`,
    "",
    ...signalLines(score.signals, view),
    "",
    ...structureBlock(score, view),
  ];
};

/** For grep: the level (or not-scored) and the signs, on one line. */
export const renderAiScoreCompact = (path: string, score: AiScore): string => {
  const level = score.level ?? `not-scored:${score.notScored?.reason ?? ""}`;
  return [`${path}: ai-score ${level} ${String(score.signs)}/${String(score.compared)}`, ...shownSignsOf(score)].join(" ");
};

/** The score as data, for the JSON report and chaff grade's results. */
export const aiScoreJson = (score: AiScore): Readonly<Record<string, unknown>> => ({
  level: score.level ?? null,
  notScored: score.notScored ?? null,
  group: score.group,
  signs: score.signs,
  compared: score.compared,
  thresholds: { medium: MEDIUM_SIGNS, high: HIGH_SIGNS },
  signals: score.signals.map((signal) => ({
    rule: signal.rule,
    count: signal.count,
    ...(signal.notRun === undefined ? {} : { notRun: signal.notRun }),
    human: signal.human ?? null,
    unusual: signal.unusual,
  })),
  structure:
    score.structure?.map((place) => ({
      id: place.feature.id,
      value: place.feature.value ?? null,
      pastShare: place.pastShare ?? null,
      limit: place.limit ?? null,
      beyond: place.beyond,
      sameAs: place.sameAs ?? null,
    })) ?? null,
});
