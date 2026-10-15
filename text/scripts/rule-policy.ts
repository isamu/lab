// Which rules run by default, decided from `yarn rules:measure` (spec §21.1). Pure: the measurement and the rules are
// passed in, so the test can hold every rule to what the committed corpus/rules-measure.json says.
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";
import type { GenreData } from "../packages/chaff/src/genre-parse.ts";
import { presetLevelsOf } from "../packages/chaff/src/genre-parse.ts";
import { severityAt } from "../packages/chaff/src/levels.ts";
import { benchPrecision, shareOf, type RuleMeasure } from "./rules-measure-score.ts";
import { precisionOf, type GroupPrecision, type LanguagePrecision } from "./rules-precision-score.ts";

/** A rule that reports on at most this share of a group's human documents runs at its own level there. */
export const NORMAL_MAX_SHARE = 0.1;
/** A rule that reports on more than this share of a group's human documents is off for that group: it describes the genre, not a mistake. */
export const OFF_MIN_SHARE = 0.5;
/** Fewer documents than this in a group, and one document moves the share past either line: the group does not decide. */
export const MIN_DOCUMENTS = 10;
/** Every finding a rule gives in the bench and the AI-shape bench must be right for it to run at its own level. */
export const BENCH_MIN_PRECISION = 1;
/** A rule whose judged findings in a group are right this often or less is off for that group (yarn rules:precision). */
export const LOW_PRECISION_MAX = 0.2;
/** Fewer judged findings than this, and one verdict moves the precision too far: the group does not decide. */
export const PRECISION_MIN_FINDINGS = 15;
/** Findings from fewer documents than this are one document's pattern, not the group's: the group does not decide. */
export const PRECISION_MIN_DOCUMENTS = 3;

/** Enough judged findings, from enough documents, show the rule is rarely right in this language. */
export const isRarelyRight = (counts: LanguagePrecision): boolean =>
  counts.correct + counts.falsePositive >= PRECISION_MIN_FINDINGS &&
  counts.documents >= PRECISION_MIN_DOCUMENTS &&
  (precisionOf(counts) ?? 1) <= LOW_PRECISION_MAX;

/**
 * The groups where the rule is rarely right in every language it reports in there. off_for turns a rule off for a
 * group in both languages, so a language it reports in without that evidence (too few verdicts, or only unjudged
 * findings) keeps the group on; a language it gives no finding in has nothing to lose.
 */
export const lowPrecisionGroups = (groups: Readonly<Record<string, GroupPrecision>> | undefined): string[] =>
  Object.entries(groups ?? {})
    .filter(([, languages]) => Object.keys(languages).length > 0 && Object.values(languages).every(isRarelyRight))
    .map(([group]) => group);

/**
 * The groups with a genre that genres.yaml turns this rule on for by hand, with its reason written there. Judged
 * precision does not overrule a written reason: the group stays on, and `yarn rules:precision` lists it for a person.
 */
export const heldOnGroups = (data: GenreData, rule: string): Set<string> =>
  new Set(data.genres.filter((genre) => genre.rules[rule] !== undefined && genre.rules[rule] !== "off").map((genre) => genre.id.split("/")[0] ?? genre.id));

/**
 * How a rule runs with no settings:
 *   judge:        a meaning check (L4) that `chaff test` runs; not measured here
 *   experimental: no group has enough documents it ran on; runs only with --experimental
 *   normal:       on, at its own level
 *   info:         on, but its findings are information (reports on too many human documents, or a bench finding was wrong)
 * `off` lists the groups it reports on most human documents of, and those its judged findings are rarely right in;
 * it is off for every genre in them.
 */
export type Standing = { readonly kind: "judge" } | { readonly kind: "experimental" } | { readonly kind: "normal" | "info"; readonly off: readonly string[] };

type RuleFacts = Pick<RuleDefinition, "id" | "layer" | "status">;

const benchPasses = (measure: RuleMeasure): boolean => {
  const precision = benchPrecision(measure);
  const missed = measure.bench === undefined ? 0 : measure.bench.planted - measure.bench.found;
  return missed === 0 && (precision === undefined || precision >= BENCH_MIN_PRECISION);
};

/** The groups with enough documents to decide, with the share of them the rule reports on. */
const decidingShares = (measure: RuleMeasure): (readonly [string, number])[] =>
  Object.entries(measure.groups)
    .filter(([, share]) => share.documents >= MIN_DOCUMENTS)
    .map(([group, share]) => [group, shareOf(share)] as const);

/**
 * handOff: the groups the rule's off_for already turns it off for (a written reason, not a measurement).
 * lowPrecision: the groups lowPrecisionGroups names for the rule.
 */
export const standingOf = (rule: RuleFacts, measure: RuleMeasure | undefined, handOff: ReadonlySet<string>, lowPrecision: readonly string[] = []): Standing => {
  if (rule.layer === "L4") return { kind: "judge" };
  const shares = measure === undefined ? [] : decidingShares(measure);
  if (measure === undefined || shares.length === 0) return { kind: "experimental" };
  const crowded = shares.filter(([, share]) => share > OFF_MIN_SHARE).map(([group]) => group);
  const off = [...crowded, ...lowPrecision.filter((group) => !crowded.includes(group))];
  const running = shares.filter(([group]) => !off.includes(group) && !handOff.has(group)).map(([, share]) => share);
  const worst = Math.max(0, ...running);
  return { kind: worst <= NORMAL_MAX_SHARE && benchPasses(measure) ? "normal" : "info", off };
};

/**
 * The groups whose preset turns this rule off by hand (genres.yaml with the rule files' off_for). A measured off is the
 * measurement's own output, not a reason: counting it would let the previous --apply decide the next one.
 */
export const handOffGroups = (data: GenreData, rule: string, marks: readonly MeasuredOff[] = []): Set<string> =>
  new Set(
    data.groups.filter((group) => group.rules[rule] === "off" && !marks.some((mark) => mark.group === group.id && mark.rule === rule)).map((group) => group.id),
  );

const genresOf = (data: GenreData, group: string): string[] => data.genres.map((genre) => genre.id).filter((genre) => genre.split("/")[0] === group);

/** A group off that `yarn rules:measure --apply` wrote into a rule file's off_for ("<group>: measured by yarn rules:measure"). */
export type MeasuredOff = { readonly group: string; readonly rule: string };

const statusProblem = (rule: RuleFacts, standing: Standing): string[] => {
  if (rule.status === "deprecated" || standing.kind === "judge") return [];
  const wanted = standing.kind === "experimental" ? "experimental" : "stable";
  return rule.status === wanted ? [] : [`${rule.id}: status is ${rule.status}, the measurement says ${wanted}`];
};

const severityProblem = (rule: RuleDefinition, standing: Standing): string[] =>
  standing.kind === "info" && severityAt(rule, "normal") !== "info" ? [`${rule.id}: reports at ${severityAt(rule, "normal")}, the measurement says info`] : [];

const offProblems = (rule: RuleFacts, standing: Standing, data: GenreData): string[] => {
  if (standing.kind !== "normal" && standing.kind !== "info") return [];
  return standing.off.flatMap((group) =>
    genresOf(data, group)
      .filter((genre) => presetLevelsOf(data, genre)[rule.id] !== "off")
      .map((genre) => `${rule.id}: runs in ${genre}, the measurement says off for ${group}`),
  );
};

const unmeasuredOffs = (rule: RuleFacts, standing: Standing, marks: readonly MeasuredOff[]): string[] => {
  const off = standing.kind === "normal" || standing.kind === "info" ? standing.off : [];
  return marks
    .filter((mark) => mark.rule === rule.id && !off.includes(mark.group))
    .map((mark) => `${rule.id}: its off_for turns it off for ${mark.group} as measured, the measurement no longer says so`);
};

/** Where a rule's status, severity and genre offs disagree with its standing. Empty when they agree. */
export const disagreements = (rule: RuleDefinition, standing: Standing, data: GenreData, marks: readonly MeasuredOff[]): string[] => [
  ...statusProblem(rule, standing),
  ...severityProblem(rule, standing),
  ...offProblems(rule, standing, data),
  ...unmeasuredOffs(rule, standing, marks),
];
