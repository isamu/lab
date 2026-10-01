import { existsSync } from "node:fs";
import type { Config } from "../config/load.ts";
import type { Detector, Lexicon, RuleDefinition } from "../plugin.ts";
import type { StyleDefinition } from "../style-parse.ts";
import { customRulesOf } from "../custom/load.ts";
import { withStyle } from "../config/style.ts";
import { moduleDetector } from "./module-detector.ts";
import { detectorExport, type ExportProblem } from "./rule-export.ts";
import { importDefault } from "./import-default.ts";
import { loadPlugins } from "./plugin-load.ts";
import type { ParsedPlugin, PluginProblem } from "./plugin-parse.ts";

// The code chaff.yaml names, loaded once before anything runs: each type: module rule's file, and each plugin under
// plugins:. Loading runs that code, which is why only chaff.yaml can name it. What cannot be loaded stops the run
// (settingProblems), like a rule in custom_rules that cannot be read: a rule that silently does not run looks like a clean document.

/** A rule whose file could not be loaded. file is the path as chaff.yaml writes it; detail: why, or what ExportProblem says. */
export type LoadProblem = {
  readonly kind: "missing-file" | "import-failed" | ExportProblem["kind"];
  readonly rule: string;
  readonly file: string;
  readonly detail: string;
};

/** What was loaded, and what could not be. */
export type Extensions = {
  /** The detector of each type: module rule and each plugin rule written in code, by the rule's id. */
  readonly detectors: Readonly<Record<string, Detector>>;
  /** The plugins' rules, with their ids under each plugin's name. */
  readonly rules: readonly RuleDefinition[];
  /** The plugins' word lists by language, then by name. */
  readonly lexicons: Readonly<Record<string, Readonly<Record<string, Lexicon>>>>;
  /** The plugins' house styles. */
  readonly styles: readonly StyleDefinition[];
  readonly problems: readonly LoadProblem[];
  readonly pluginProblems: readonly PluginProblem[];
};

type Loaded = { readonly detector: Detector } | { readonly problem: LoadProblem };

/** A type: module rule: its id, its file, and the path as chaff.yaml writes it, which every message names. */
type ModuleRule = { readonly id: string; readonly file: string; readonly written: string };

const loadRule = async ({ id, file, written }: ModuleRule): Promise<Loaded> => {
  const at = { rule: id, file: written };
  if (!existsSync(file)) return { problem: { ...at, kind: "missing-file", detail: "" } };
  const imported = await importDefault(file);
  if ("message" in imported) return { problem: { ...at, kind: "import-failed", detail: imported.message } };
  const read = detectorExport(imported.exported);
  return "problem" in read ? { problem: { ...at, ...read.problem } } : { detector: moduleDetector(read.detect, written) };
};

const moduleRulesOf = (rules: readonly RuleDefinition[]): ModuleRule[] =>
  rules.flatMap((rule) => (rule.custom?.type === "module" ? [{ id: rule.id, file: rule.custom.file, written: rule.custom.module }] : []));

/** Every type: module rule in chaff.yaml, loaded one by one in the order written, so the same chaff.yaml loads the same way. */
const loadModuleRules = async (config: Config): Promise<readonly { readonly id: string; readonly loaded: Loaded }[]> =>
  moduleRulesOf(customRulesOf(config).rules).reduce<Promise<{ id: string; loaded: Loaded }[]>>(
    async (done, rule) => [...(await done), { id: rule.id, loaded: await loadRule(rule) }],
    Promise.resolve([]),
  );

/** A plugin's code rules, each run as one of chaff's; a failure names the plugin as chaff.yaml writes it. */
const pluginDetectors = (plugin: ParsedPlugin): [string, Detector][] =>
  Object.entries(plugin.detectors).map(([id, detect]) => [id, moduleDetector(detect, plugin.written)]);

const lexiconsByLanguage = (plugins: readonly ParsedPlugin[]): Record<string, Record<string, Lexicon>> => {
  const languages = [...new Set(plugins.flatMap((plugin) => Object.keys(plugin.lexicons)))];
  return Object.fromEntries(
    languages.map((language) => [language, plugins.reduce<Record<string, Lexicon>>((merged, plugin) => ({ ...merged, ...plugin.lexicons[language] }), {})]),
  );
};

/** Everything chaff.yaml names in code, loaded. */
export const loadExtensions = async (config: Config): Promise<Extensions> => {
  const modules = await loadModuleRules(config);
  const { plugins, problems: pluginProblems } = await loadPlugins(config);
  return {
    detectors: Object.fromEntries([
      ...modules.flatMap((entry): [string, Detector][] => ("detector" in entry.loaded ? [[entry.id, entry.loaded.detector]] : [])),
      ...plugins.flatMap(pluginDetectors),
    ]),
    rules: plugins.flatMap((plugin) => plugin.rules),
    lexicons: lexiconsByLanguage(plugins),
    styles: plugins.flatMap((plugin) => plugin.styles),
    problems: modules.flatMap((entry) => ("problem" in entry.loaded ? [entry.loaded.problem] : [])),
    pluginProblems,
  };
};

/** chaff.yaml with the code it names loaded, and the style it names applied when a plugin ships it. */
export const withExtensions = async (config: Config): Promise<Config> => {
  const extensions = await loadExtensions(config);
  return withStyle({ ...config, extensions }, extensions.styles);
};
