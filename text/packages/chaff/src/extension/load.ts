import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { Config } from "../config/load.ts";
import type { Detector, RuleDefinition } from "../plugin.ts";
import { customRulesOf } from "../custom/load.ts";
import { moduleDetector } from "./module-detector.ts";
import { detectorExport, type ExportProblem } from "./rule-export.ts";

// The code chaff.yaml names, loaded once before anything runs: each type: module rule's file. Loading runs the file's
// code, which is why only chaff.yaml can name one. What cannot be loaded stops the run (settingProblems), like any rule
// in custom_rules that cannot be read: a rule that silently does not run looks like a clean document.

/** A rule whose file could not be loaded. file is the path as chaff.yaml writes it; detail: why, or what ExportProblem says. */
export type LoadProblem = {
  readonly kind: "missing-file" | "import-failed" | ExportProblem["kind"];
  readonly rule: string;
  readonly file: string;
  readonly detail: string;
};

/** What was loaded: each rule's detector by the rule's id, and what could not be loaded. */
export type Extensions = { readonly detectors: Readonly<Record<string, Detector>>; readonly problems: readonly LoadProblem[] };

type Loaded = { readonly detector: Detector } | { readonly problem: LoadProblem };

const firstLine = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";

/** The module's default export, or the first line of why it could not be imported (a syntax error, a missing import). */
const importDefault = async (file: string): Promise<{ readonly exported: unknown } | { readonly message: string }> => {
  try {
    const namespace: unknown = await import(pathToFileURL(file).href);
    return { exported: typeof namespace === "object" && namespace !== null && "default" in namespace ? namespace.default : undefined };
  } catch (error) {
    return { message: firstLine(error) };
  }
};

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

/** Every type: module rule in chaff.yaml, loaded. One by one, in the order written, so the same chaff.yaml loads the same way. */
export const loadExtensions = async (config: Config): Promise<Extensions> => {
  const loaded = await moduleRulesOf(customRulesOf(config).rules).reduce<Promise<{ id: string; loaded: Loaded }[]>>(
    async (done, rule) => [...(await done), { id: rule.id, loaded: await loadRule(rule) }],
    Promise.resolve([]),
  );
  return {
    detectors: Object.fromEntries(loaded.flatMap((entry) => ("detector" in entry.loaded ? [[entry.id, entry.loaded.detector]] : []))),
    problems: loaded.flatMap((entry) => ("problem" in entry.loaded ? [entry.loaded.problem] : [])),
  };
};

/** chaff.yaml with the code it names loaded. */
export const withExtensions = async (config: Config): Promise<Config> => ({ ...config, extensions: await loadExtensions(config) });
