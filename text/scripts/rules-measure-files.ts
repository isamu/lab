// The files the rule policy reads and writes: corpus/rules-measure.json, the rule YAML files (with their off_for) and genres.yaml.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { parseGenres, withRuleOffs, type GenreData } from "../packages/chaff/src/genre-parse.ts";
import { loadRuleOffs } from "../packages/chaff/src/rule-offs.ts";
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";
import { severityAt } from "../packages/chaff/src/levels.ts";
import { loadGenres } from "../packages/chaff/src/genre-load.ts";
import type { Settings } from "../packages/chaff/src/run.ts";
import { disagreements, handOffGroups, standingOf, type MeasuredOff, type Standing } from "./rule-policy.ts";
import { MEASURED, measuredOffsOf, withInfoAtNormal, withMeasuredOffs, withStatus } from "./rules-apply.ts";
import { isMeasurement, type Measurement } from "./rules-measure-score.ts";

const ROOT = join(import.meta.dirname, "..");
export const MEASURE_FILE = join(ROOT, "corpus", "rules-measure.json");
const PACKAGE = join(ROOT, "packages", "chaff");
const RULES_DIR = join(PACKAGE, "rules");
const GENRES_FILE = join(PACKAGE, "genres.yaml");

export const readMeasurement = (path: string = MEASURE_FILE): Measurement => {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isMeasurement(parsed)) throw new Error(`${path}: not a rules measurement (yarn rules:measure --write)`);
  return parsed;
};

/** The rules of both languages, one definition per id (the Japanese one where both load it). */
export const allRules = (): RuleDefinition[] => [...new Map([...loadRules("en"), ...loadRules("ja")].map((rule) => [rule.id, rule])).values()];

const bothLanguages = (): RuleDefinition[] => [...loadRules("ja"), ...loadRules("en")];

const reportsBelowInfo = (id: string): boolean => bothLanguages().some((rule) => rule.id === id && severityAt(rule, "normal") !== "info");

export const readGenresText = (): string => readFileSync(GENRES_FILE, "utf8");
export const genreDataOf = (text: string): GenreData => withRuleOffs(parseGenres(parse(text)), loadRuleOffs(RULES_DIR));

const rulePath = (rule: string): string => join(RULES_DIR, `${rule}.yaml`);

/** The offs `--apply` wrote into the rule files. */
const measuredOffs = (rules: readonly RuleDefinition[]): MeasuredOff[] =>
  rules.flatMap((rule) => measuredOffsOf(rule.id, readFileSync(rulePath(rule.id), "utf8")));

const atStart: { offs?: readonly MeasuredOff[] } = {};

/** The measured offs, read once: the bench and the tests ask for every sample, and only --apply rewrites the files. */
const measuredOffsAtStart = (): readonly MeasuredOff[] =>
  (atStart.offs ??= loadRuleOffs(RULES_DIR)
    .filter((off) => off.reason === MEASURED)
    .map((off) => ({ group: off.target, rule: off.rule })));

/**
 * The rules a genre is off for only because the measurement says so, at normal. The bench and the detector tests turn
 * them back on: they read whether a detector finds a mistake, not whether it runs by default. A rule the genre turns off
 * by hand stays off.
 */
export const measuredOffOn = (genre: string): Settings => {
  const own = loadGenres().genres.find((entry) => entry.id === genre)?.rules ?? {};
  const group = genre.split("/")[0];
  return Object.fromEntries(
    measuredOffsAtStart()
      .filter((off) => off.group === group && own[off.rule] === undefined)
      .map((off) => [off.rule, "normal"] as const),
  );
};

/** Each rule's standing under the measurement, in rule id order. marks: the offs --apply wrote, which are not hand offs. */
export const standingsOf = (
  measurement: Measurement,
  rules: readonly RuleDefinition[],
  data: GenreData,
  marks: readonly MeasuredOff[] = measuredOffs(rules),
): Map<string, Standing> =>
  new Map(
    rules
      .toSorted((left, right) => left.id.localeCompare(right.id, "en"))
      .map((rule) => [rule.id, standingOf(rule, measurement.rules[rule.id], handOffGroups(data, rule.id, marks))] as const),
  );

/** A rule that landed after the last measurement: the policy cannot place it until `yarn rules:measure --apply` runs. */
const unmeasured = (rule: RuleDefinition, measurement: Measurement): string[] =>
  rule.layer === "L4" || rule.status === "deprecated" || Object.hasOwn(measurement.rules, rule.id)
    ? []
    : [`${rule.id}: not measured yet (yarn rules:measure --apply)`];

/** Every disagreement between the rules as written and the measurement. */
export const policyProblems = (measurement: Measurement): string[] => {
  const data = genreDataOf(readGenresText());
  const rules = allRules();
  const marks = measuredOffs(rules);
  const standings = standingsOf(measurement, rules, data, marks);
  // Each language's definition: a rule may write its severity per language.
  const problems = bothLanguages().flatMap((rule) => {
    const standing = standings.get(rule.id);
    return [...unmeasured(rule, measurement), ...(standing === undefined ? [] : disagreements(rule, standing, data, marks))];
  });
  return [...new Set(problems)];
};

const rewriteRule = (rule: RuleDefinition, standing: Standing): string | undefined => {
  if (standing.kind === "judge" || rule.status === "deprecated") return undefined;
  const path = rulePath(rule.id);
  const before = readFileSync(path, "utf8");
  const status = withStatus(before, standing.kind === "experimental" ? "experimental" : "stable");
  const after = standing.kind === "info" && reportsBelowInfo(rule.id) ? withInfoAtNormal(status) : status;
  if (after === before) return undefined;
  writeFileSync(path, after);
  return `${rule.id}: ${standing.kind}`;
};

const offGroupsOf = (standing: Standing): readonly string[] => (standing.kind === "normal" || standing.kind === "info" ? standing.off : []);

/** The rule file's off_for with exactly these measured groups. */
const rewriteOffs = (rule: string, groups: readonly string[]): void => {
  const path = rulePath(rule);
  const before = readFileSync(path, "utf8");
  const after = withMeasuredOffs(before, groups);
  if (after !== before) writeFileSync(path, after);
};

/** Rewrites the rule files to agree with the measurement, and says what it changed. */
export const applyMeasurement = (measurement: Measurement): string[] => {
  const rules = allRules();
  const missing = rules.flatMap((rule) => unmeasured(rule, measurement));
  if (missing.length > 0) throw new Error(`the measurement leaves rules out; measure again without --from:\n${missing.join("\n")}`);
  const standings = standingsOf(measurement, rules, genreDataOf(readGenresText()));
  const changed = rules.flatMap((rule) => {
    const standing = standings.get(rule.id);
    const line = standing === undefined ? undefined : rewriteRule(rule, standing);
    return line === undefined ? [] : [line];
  });
  const offs = [...standings.entries()].flatMap(([rule, standing]) => offGroupsOf(standing).map((group) => ({ group, rule })));
  standings.forEach((standing, rule) => rewriteOffs(rule, offGroupsOf(standing)));
  return [...changed, ...offs.map((off) => `${off.rule}: off for ${off.group}`)];
};
