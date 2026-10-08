import { loadAdapter } from "./adapter-load.ts";
import { applyByPath } from "./config/by-path.ts";
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
import { applySuppressions, type Applied } from "./stet.ts";

/** A document's language when nothing names one for this run: its by_path entry, chaff.yaml's language, then a guess from the text. */
export const documentLanguage = (path: string, source: string, config: Config): string =>
  applyByPath(config.byPath, config.baseDir, path).language ?? config.language ?? guessLanguage(source).language;

/** What this run chose over the settings: a language and a genre, when given, and whether experimental rules run. */
export type CheckChoice = { readonly language?: string | undefined; readonly genre?: string | undefined; readonly experimental: boolean };

/** One document linted: the rules that ran and why others did not, before and after stet silenced some. */
export type SourceCheck = {
  readonly language: string;
  readonly genre: ResolvedGenre;
  readonly rules: readonly RuleDefinition[];
  readonly doc: ProseDocument;
  /** What the rules ran with. The pass over several documents runs with it too. */
  readonly context: RunContext;
  readonly raw: RunResult;
  readonly applied: Applied;
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
export const checkSource = async (path: string, source: string, config: Config, choice: CheckChoice): Promise<SourceCheck> => {
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
  };
  const raw = runRulesWith(doc, rules, context);
  return { language, genre, rules, doc, context, raw, applied: suppressedIn(source, doc, raw) };
};

/** stet で黙らせたものは、ここで落とす。stet は text（読んだままの本文）から読む。 */
const suppressedIn = (text: string, doc: ProseDocument, raw: RunResult): Applied =>
  applySuppressions(
    text,
    raw.findings,
    doc.sections.map((section) => section.span),
  );

/**
 * The checks of one run's documents, with the rules that compare documents run over all of them (cross-run.ts), and
 * stet applied to their findings in the file each lands in. A run of one document comes back as it is.
 */
export const crossChecked = (checks: readonly SourceCheck[], detectors: Readonly<Record<string, CrossDetector>> = CROSS_DETECTORS): SourceCheck[] => {
  if (checks.length < 2) return [...checks];
  const results = runCrossRules(checks, detectors);
  return checks.map((check, index) => {
    const raw = results[index] ?? check.raw;
    return raw === check.raw ? check : { ...check, raw, applied: suppressedIn(check.doc.source, check.doc, raw) };
  });
};
