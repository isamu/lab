import { loadAdapter } from "./adapter-load.ts";
import { applyByPath } from "./config/by-path.ts";
import type { Config } from "./config/load.ts";
import { optionLayersOf } from "./config/option-problems.ts";
import { limitsFor } from "./config/style.ts";
import { rulesOf } from "./custom/load.ts";
import { guessLanguage } from "./detect.ts";
import { buildDocument, teamRules } from "./document.ts";
import type { ProseDocument, RuleDefinition } from "./plugin.ts";
import { profileFor } from "./profile/for-file.ts";
import { resolveGenre, type ResolvedGenre } from "./resolve-genre.ts";
import { neededBy, runRulesWith, type RunResult } from "./run.ts";
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
  readonly raw: RunResult;
  readonly applied: Applied;
};

/** Lints one text as `chaff <file>` does. The file need not exist: `chaff grade` checks a model's output from memory. */
export const checkSource = async (path: string, source: string, config: Config, choice: CheckChoice): Promise<SourceCheck> => {
  const language = choice.language ?? documentLanguage(path, source, config);
  const adapter = await loadAdapter(language);
  const genre = resolveGenre(path, source, config, choice.genre);
  const rules = rulesOf(language, config);
  await adapter.prepare?.(neededBy(rules, config.rules, choice.experimental, genre.genre, language));
  const doc = buildDocument(path, source, adapter, teamRules(config, language), profileFor(config, path, source, language, genre.genre));
  const raw = runRulesWith(doc, rules, {
    settings: config.rules,
    experimental: choice.experimental,
    genre: genre.genre,
    limits: limitsFor(config, language),
    optionLayers: optionLayersOf(config),
    detectors: config.extensions?.detectors ?? {},
  });
  // stet で黙らせたものは、ここで落とす。
  const applied = applySuppressions(
    source,
    raw.findings,
    doc.sections.map((section) => section.span),
  );
  return { language, genre, rules, doc, raw, applied };
};
