// The files the rule policy reads and writes: corpus/rules-measure.json, the rule YAML files and genres.yaml.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { parseGenres, type GenreData } from "../packages/chaff/src/genre-parse.ts";
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";
import { severityAt } from "../packages/chaff/src/levels.ts";
import { loadGenres } from "../packages/chaff/src/genre-load.ts";
import type { Settings } from "../packages/chaff/src/run.ts";
import { disagreements, handOffGroups, standingOf, type Standing } from "./rule-policy.ts";
import { measuredOffsOf, withInfoAtNormal, withMeasuredOffs, withStatus } from "./rules-apply.ts";
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

/**
 * The rules a genre is off for only because the measurement says so, at normal. The bench and the detector tests turn
 * them back on: they read whether a detector finds a mistake, not whether it runs by default. A rule the genre turns off
 * by hand stays off.
 */
export const measuredOffOn = (genre: string): Settings => {
  const own = loadGenres().genres.find((entry) => entry.id === genre)?.rules ?? {};
  const group = genre.split("/")[0];
  return Object.fromEntries(
    measuredOffsOf(readGenresText())
      .filter((off) => off.group === group && own[off.rule] === undefined)
      .map((off) => [off.rule, "normal"] as const),
  );
};
export const genreDataOf = (text: string): GenreData => parseGenres(parse(text));

/** Each rule's standing under the measurement, in rule id order. */
export const standingsOf = (measurement: Measurement, rules: readonly RuleDefinition[], data: GenreData): Map<string, Standing> =>
  new Map(
    rules
      .toSorted((left, right) => left.id.localeCompare(right.id, "en"))
      .map((rule) => [rule.id, standingOf(rule, measurement.rules[rule.id], handOffGroups(data, rule.id))] as const),
  );

/** Every disagreement between the rules as written and the measurement. */
export const policyProblems = (measurement: Measurement): string[] => {
  const text = readGenresText();
  const data = genreDataOf(text);
  const marks = measuredOffsOf(text);
  const standings = standingsOf(measurement, allRules(), data);
  // Each language's definition: a rule may write its severity per language.
  const problems = bothLanguages().flatMap((rule) => {
    const standing = standings.get(rule.id);
    return standing === undefined ? [] : disagreements(rule, standing, data, marks);
  });
  return [...new Set(problems)];
};

const rewriteRule = (rule: RuleDefinition, standing: Standing): string | undefined => {
  if (standing.kind === "judge" || rule.status === "deprecated") return undefined;
  const path = join(RULES_DIR, `${rule.id}.yaml`);
  const before = readFileSync(path, "utf8");
  const status = withStatus(before, standing.kind === "experimental" ? "experimental" : "stable");
  const after = standing.kind === "info" && reportsBelowInfo(rule.id) ? withInfoAtNormal(status) : status;
  if (after === before) return undefined;
  writeFileSync(path, after);
  return `${rule.id}: ${standing.kind}`;
};

/** Rewrites the rule files and genres.yaml to agree with the measurement, and says what it changed. */
export const applyMeasurement = (measurement: Measurement): string[] => {
  const text = readGenresText();
  const rules = allRules();
  const standings = standingsOf(measurement, rules, genreDataOf(text));
  const changed = rules.flatMap((rule) => {
    const standing = standings.get(rule.id);
    const line = standing === undefined ? undefined : rewriteRule(rule, standing);
    return line === undefined ? [] : [line];
  });
  const offs = [...standings.entries()].flatMap(([rule, standing]) =>
    standing.kind === "normal" || standing.kind === "info" ? standing.off.map((group) => ({ group, rule })) : [],
  );
  const genres = withMeasuredOffs(text, offs);
  if (genres !== text) writeFileSync(GENRES_FILE, genres);
  return [...changed, ...offs.map((off) => `${off.rule}: off for ${off.group}`)];
};
