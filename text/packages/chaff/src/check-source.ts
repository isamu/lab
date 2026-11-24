import { loadAdapter } from "./adapter-load.ts";
import { applyByPath } from "./config/by-path.ts";
import { configForPath } from "./config/by-path-rules.ts";
import type { Config } from "./config/load.ts";
import { optionLayersOf } from "./config/option-problems.ts";
import { limitsFor } from "./config/style.ts";
import { rulesOf } from "./custom/load.ts";
import { guessLanguage } from "./detect.ts";
import { buildDocument, teamRules } from "./document.ts";
import type { AdapterNeeds, CrossDetector, ProseDocument, RuleDefinition } from "./plugin.ts";
import { profileFor } from "./profile/for-file.ts";
import { resolveGenre, type ResolvedGenre } from "./resolve-genre.ts";
import { neededBy, runRulesWith, type RunContext, type RunResult } from "./run.ts";
import { runCrossRules } from "./cross-run.ts";
import { CROSS_DETECTORS } from "./detectors/index.ts";
import { applySuppressions, knownRulesOf, type Applied } from "./stet.ts";
import type { PerFile } from "./render/suppressions.ts";
import { allowFor, allowOf, applyAllow, type AllowEntry, type Allowed } from "./allow.ts";

/** A document's language when nothing names one for this run: its by_path entry, chaff.yaml's language, then a guess from the text. */
export const documentLanguage = (path: string, source: string, config: Config): string =>
  applyByPath(config.byPath, config.baseDir, path).language ?? config.language ?? guessLanguage(source).language;

/** What this run chose over the settings: a language and a genre, when given, and whether experimental rules run. */
export type CheckChoice = { readonly language?: string | undefined; readonly genre?: string | undefined; readonly experimental: boolean };

/** Findings after stet and chaff.yaml's allow: kept holds what neither silenced; allowed what an allow entry did. */
export type Silenced = Applied & { readonly allowed: readonly Allowed[] };

/** What `chaff suppressions` lists for one file: what stet and allow silenced, stets without a reason, range stets and stet problems. */
export const silencedOf = (applied: Silenced): Omit<PerFile, "path" | "notRun"> => ({
  suppressed: applied.suppressed,
  allowed: applied.allowed,
  reasonless: applied.unusedReasonless,
  ranges: applied.ranges,
  problems: applied.problems,
});

/** One document linted: the rules that ran and why others did not, before and after stet and allow silenced some. */
export type SourceCheck = {
  readonly language: string;
  readonly genre: ResolvedGenre;
  readonly rules: readonly RuleDefinition[];
  readonly doc: ProseDocument;
  /** What the rules ran with. The pass over several documents runs with it too. */
  readonly context: RunContext;
  readonly raw: RunResult;
  readonly applied: Silenced;
  /** chaff.yaml's allow entries that cover this file. The pass over several documents applies them too. */
  readonly allow: readonly AllowEntry[];
};

/** What the language adapter is asked to prepare for these rules under this chaff.yaml: what the running rules read, nothing more. */
export const adapterNeedsOf = (
  rules: readonly RuleDefinition[],
  config: Pick<Config, "rules">,
  experimental: boolean,
  genre: string,
  language: string,
): AdapterNeeds => neededBy(rules, config.rules, experimental, genre, language);

/** Lints one text as `chaff <file>` does. The file need not exist: `chaff grade` checks a model's output from memory. */
export const checkSource = async (path: string, source: string, written: Config, choice: CheckChoice): Promise<SourceCheck> => {
  const config = configForPath(written, path);
  const language = choice.language ?? documentLanguage(path, source, config);
  const adapter = await loadAdapter(language);
  const genre = resolveGenre(path, source, config, choice.genre);
  const rules = rulesOf(language, config);
  await adapter.prepare?.(adapterNeedsOf(rules, config, choice.experimental, genre.genre, language));
  const doc = buildDocument(path, source, adapter, teamRules(config, language), profileFor(config, path, source, language, genre.genre));
  const context: RunContext = {
    settings: config.rules,
    experimental: choice.experimental,
    genre: genre.genre,
    limits: limitsFor(config, language),
    optionLayers: optionLayersOf(config),
    detectors: config.extensions?.detectors ?? {},
    levelsFrom: config.pathLevelsFrom ?? {},
  };
  const raw = runRulesWith(doc, rules, context);
  const allow = allowFor(allowOf(config.allow).entries, config.baseDir, path);
  return { language, genre, rules, doc, context, raw, allow, applied: suppressedIn(source, doc, raw, rules, allow) };
};

/** stet で黙らせたものと、chaff.yaml の allow に当たるものは、ここで落とす。stet が先、allow が後。どちらも text（読んだままの本文）から読む。 */
const suppressedIn = (text: string, doc: ProseDocument, raw: RunResult, rules: readonly RuleDefinition[], allow: readonly AllowEntry[]): Silenced => {
  const stetted = applySuppressions(
    text,
    raw.findings,
    doc.sections.map((section) => section.span),
    knownRulesOf(rules),
  );
  const allowed = applyAllow(text, stetted.kept, allow);
  return { ...stetted, kept: allowed.kept, allowed: allowed.allowed };
};

/**
 * The checks of one run's documents, with the rules that compare documents run over all of them (cross-run.ts), and
 * stet applied to their findings in the file each lands in. A run of one document comes back as it is.
 */
export const crossChecked = (checks: readonly SourceCheck[], detectors: Readonly<Record<string, CrossDetector>> = CROSS_DETECTORS): SourceCheck[] => {
  if (checks.length < 2) return [...checks];
  const results = runCrossRules(checks, detectors);
  return checks.map((check, index) => {
    const raw = results[index] ?? check.raw;
    return raw === check.raw ? check : { ...check, raw, applied: suppressedIn(check.doc.source, check.doc, raw, check.rules, check.allow) };
  });
};
