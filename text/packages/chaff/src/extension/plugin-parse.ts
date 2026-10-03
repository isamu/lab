import { dirname } from "node:path";
import { API_VERSION } from "../api.ts";
import type { Lexicon, LexiconEntry, RuleDefinition } from "../plugin.ts";
import { parseCustomRules, type CustomProblem } from "../custom/parse.ts";
import { styleOf, type StyleDefinition } from "../style-parse.ts";
import type { UntrustedDetector } from "./module-detector.ts";
import { describeValue } from "./returned-findings.ts";
import { isPluginName } from "./plugin-name.ts";
import { knownGenres } from "../known-genres.ts";

// What a plugin package exports (api.ts PluginSpec), read into what chaff runs: its rules with ids under the plugin's
// name, their detectors, its word lists and its house styles. A rule is read exactly like a rule in custom_rules, with
// detect in place of type: module. Pure: the module comes in already imported.

/** What can be wrong in finding and loading a plugin (plugin-load.ts), and in what it exports (here). */
type PluginProblemKind =
  | "not-a-list"
  | "bad-specifier"
  | "outside"
  | "not-found"
  | "import-failed"
  | "duplicate-name"
  | "bad-export"
  | "no-api-version"
  | "api-version"
  | "bad-name"
  | "name-mismatch"
  | "no-detect"
  | "bad-lexicon"
  | "bad-style";

/** plugin: as chaff.yaml writes it. detail: what was there instead, the name expected, the rule, list or style at fault. */
export type PluginProblem =
  | { readonly kind: PluginProblemKind; readonly plugin: string; readonly detail: string }
  | { readonly kind: "rule"; readonly plugin: string; readonly problem: CustomProblem };

/** Where a plugin came from: as chaff.yaml writes it, the file imported, and the name its package's name gives (none for a path). */
export type PluginOrigin = { readonly written: string; readonly file: string; readonly expectedName: string | undefined };

export type ParsedPlugin = {
  readonly name: string;
  /** The plugin as chaff.yaml writes it (chaff-plugin-foo, ./local-plugin), which a failing rule's reason names. */
  readonly written: string;
  readonly rules: readonly RuleDefinition[];
  /** Each code rule's detector, by its id with the plugin's prefix. */
  readonly detectors: Readonly<Record<string, UntrustedDetector>>;
  /** Word lists by language, then by name with the plugin's prefix. */
  readonly lexicons: Readonly<Record<string, Readonly<Record<string, Lexicon>>>>;
  readonly styles: readonly StyleDefinition[];
};

export type PluginRead = { readonly plugin: ParsedPlugin | undefined; readonly problems: readonly PluginProblem[] };

type Problem = (kind: Exclude<PluginProblem["kind"], "rule">, detail: string) => PluginProblem;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const printed = (value: unknown): string => JSON.stringify(value) ?? describeValue(value);

/** A word list's or a style's own name, before the plugin's prefix. */
const LOCAL_NAME = /^[a-z][a-z0-9-]*$/u;

/** The plugin's name, checked against the name its package's name gives it. */
const nameOf = (exported: Record<string, unknown>, origin: PluginOrigin, problem: Problem): { name: string } | { problem: PluginProblem } => {
  const name = exported["name"];
  if (typeof name !== "string" || !isPluginName(name)) return { problem: problem("bad-name", printed(name)) };
  if (origin.expectedName !== undefined && name !== origin.expectedName) return { problem: problem("name-mismatch", origin.expectedName) };
  return { name };
};

const versionProblem = (exported: Record<string, unknown>, problem: Problem): PluginProblem | undefined => {
  const version = exported["apiVersion"];
  if (version === undefined) return problem("no-api-version", "");
  return version === API_VERSION ? undefined : problem("api-version", printed(version));
};

// ───────── rules ─────────

const detectOf = (entry: Record<string, unknown>): UntrustedDetector | undefined => {
  const detect = entry["detect"];
  return typeof detect === "function" ? (doc, options): unknown => Reflect.apply(detect, undefined, [doc, options]) : undefined;
};

/** A rule with detect is read as a type: module rule whose module is the plugin's own file. */
const asCustomRule = (entry: unknown, file: string): unknown =>
  isRecord(entry) && detectOf(entry) !== undefined ? { ...entry, type: "module", module: file } : entry;

/** Each code rule's detector by the id the plugin wrote. */
const detectorsByWrittenId = (entries: readonly unknown[]): ReadonlyMap<string, UntrustedDetector> =>
  new Map(
    entries.flatMap((entry): [string, UntrustedDetector][] => {
      const detect = isRecord(entry) ? detectOf(entry) : undefined;
      return isRecord(entry) && typeof entry["id"] === "string" && detect !== undefined ? [[entry["id"], detect]] : [];
    }),
  );

const withPrefix = (rule: RuleDefinition, name: string, lists: ReadonlySet<string>): RuleDefinition => ({
  ...rule,
  id: `${name}/${rule.id}`,
  plugin: name,
  word_list: rule.word_list !== undefined && lists.has(rule.word_list) ? `${name}/${rule.word_list}` : rule.word_list,
});

type RulesContext = { readonly name: string; readonly origin: PluginOrigin; readonly useFor: readonly string[]; readonly lists: ReadonlySet<string> };

type Rules = Pick<ParsedPlugin, "rules" | "detectors"> & { readonly problems: readonly PluginProblem[] };

const rulesOf = (raw: unknown, context: RulesContext): Rules => {
  const { name, origin } = context;
  const parsed = parseCustomRules(Array.isArray(raw) ? raw.map((entry: unknown) => asCustomRule(entry, origin.file)) : raw, {
    builtIn: new Set(),
    useFor: context.useFor,
    genres: knownGenres(),
    baseDir: dirname(origin.file),
  });
  const detectors = detectorsByWrittenId(Array.isArray(raw) ? raw : []);
  const runnable = parsed.rules.filter((rule) => rule.custom?.type !== "module" || detectors.has(rule.id));
  const codeless = parsed.rules.filter((rule) => !runnable.includes(rule));
  return {
    rules: runnable.map((rule) => withPrefix(rule, name, context.lists)),
    detectors: Object.fromEntries(
      runnable.flatMap((rule) => {
        const detect = detectors.get(rule.id);
        return detect === undefined ? [] : [[`${name}/${rule.id}`, detect]];
      }),
    ),
    problems: [
      ...parsed.problems.map((problem): PluginProblem => ({ kind: "rule", plugin: origin.written, problem })),
      ...codeless.map((rule): PluginProblem => ({ kind: "no-detect", plugin: origin.written, detail: rule.id })),
    ],
  };
};

// ───────── word lists ─────────

const lexiconEntryOf = (value: unknown): LexiconEntry | undefined => {
  if (typeof value === "string") return value.trim() === "" ? undefined : { pattern: value.trim() };
  if (!isRecord(value) || typeof value["pattern"] !== "string" || value["pattern"].trim() === "") return undefined;
  const [insteadOf, rewrite] = [value["instead_of"], value["rewrite"]];
  return {
    pattern: value["pattern"].trim(),
    ...(typeof insteadOf === "string" && insteadOf.trim() !== "" ? { instead_of: insteadOf.trim() } : {}),
    ...(typeof rewrite === "string" && rewrite.trim() !== "" ? { rewrite: rewrite.trim() } : {}),
  };
};

const lexiconOf = (words: unknown): Lexicon | undefined => {
  const entries = Array.isArray(words) ? words.map(lexiconEntryOf) : [undefined];
  const readable = entries.flatMap((entry) => (entry === undefined ? [] : [entry]));
  // An empty list would leave its rules running and finding nothing, which reads as a clean document.
  return readable.length === entries.length && readable.length > 0 ? readable : undefined;
};

type ListInLanguage = { readonly language: string; readonly list: string; readonly lexicon: Lexicon };

/** One word list in each language it has. undefined when any part of it cannot be read. */
const listOf = (list: string, raw: unknown): ListInLanguage[] | undefined => {
  if (!LOCAL_NAME.test(list) || !isRecord(raw)) return undefined;
  const read = Object.entries(raw).map(([language, words]) => ({ language, lexicon: lexiconOf(words) }));
  const readable = read.flatMap(({ language, lexicon }) => (lexicon === undefined ? [] : [{ language, list, lexicon }]));
  return readable.length === read.length ? readable : undefined;
};

type Lexicons = Pick<ParsedPlugin, "lexicons"> & { readonly lists: ReadonlySet<string>; readonly problems: readonly PluginProblem[] };

const byLanguage = (lists: readonly ListInLanguage[], name: string): Record<string, Record<string, Lexicon>> =>
  Object.fromEntries(
    [...new Set(lists.map((entry) => entry.language))].map((language) => [
      language,
      Object.fromEntries(lists.filter((entry) => entry.language === language).map((entry) => [`${name}/${entry.list}`, entry.lexicon])),
    ]),
  );

const lexiconsOf = (raw: unknown, name: string, problem: Problem): Lexicons => {
  if (raw === undefined) return { lexicons: {}, lists: new Set(), problems: [] };
  if (!isRecord(raw)) return { lexicons: {}, lists: new Set(), problems: [problem("bad-lexicon", printed(raw))] };
  const read = Object.entries(raw).map(([list, words]) => ({ list, inLanguages: listOf(list, words) }));
  const readable = read.flatMap((entry) => entry.inLanguages ?? []);
  return {
    lexicons: byLanguage(readable, name),
    lists: new Set(readable.map((entry) => entry.list)),
    problems: read.filter((entry) => entry.inLanguages === undefined).map((entry) => problem("bad-lexicon", entry.list)),
  };
};

// ───────── styles ─────────

/** One string reads the same in every language; a style's words need ja and en. */
const bothLanguages = (value: unknown): unknown => (typeof value === "string" ? { ja: value, en: value } : value);

const styleSpecOf = (raw: Record<string, unknown>, id: string, name: string): Record<string, unknown> => {
  const source = isRecord(raw["source"]) ? { ...raw["source"], title: bothLanguages(raw["source"]["title"]) } : raw["source"];
  return { ...raw, id: `${name}/${id}`, name: bothLanguages(raw["name"]), summary: bothLanguages(raw["summary"]), source };
};

const styleOrProblem = (entry: unknown, name: string, problem: Problem): { style: StyleDefinition } | { problem: PluginProblem } => {
  const id = isRecord(entry) ? entry["id"] : undefined;
  if (!isRecord(entry) || typeof id !== "string" || !LOCAL_NAME.test(id)) return { problem: problem("bad-style", printed(id)) };
  try {
    return { style: styleOf(styleSpecOf(entry, id, name), `${name}/${id}`) };
  } catch (error) {
    return { problem: problem("bad-style", error instanceof Error ? error.message : String(error)) };
  }
};

type Styles = Pick<ParsedPlugin, "styles"> & { readonly problems: readonly PluginProblem[] };

const stylesOf = (raw: unknown, name: string, problem: Problem): Styles => {
  if (raw === undefined) return { styles: [], problems: [] };
  if (!Array.isArray(raw)) return { styles: [], problems: [problem("bad-style", printed(raw))] };
  const read = raw.map((entry: unknown) => styleOrProblem(entry, name, problem));
  return {
    styles: read.flatMap((entry) => ("style" in entry ? [entry.style] : [])),
    problems: read.flatMap((entry) => ("problem" in entry ? [entry.problem] : [])),
  };
};

// ───────── the plugin ─────────

/** A plugin's default export, read. Every problem is reported; a plugin with any is left out whole, and the run is stopped. */
export const parsePlugin = (exported: unknown, origin: PluginOrigin, useFor: readonly string[]): PluginRead => {
  const problem: Problem = (kind, detail) => ({ kind, plugin: origin.written, detail });
  if (!isRecord(exported)) return { plugin: undefined, problems: [problem("bad-export", describeValue(exported))] };
  const version = versionProblem(exported, problem);
  if (version !== undefined) return { plugin: undefined, problems: [version] };
  const named = nameOf(exported, origin, problem);
  if ("problem" in named) return { plugin: undefined, problems: [named.problem] };
  const { name } = named;
  const lexicons = lexiconsOf(exported["lexicons"], name, problem);
  const rules = rulesOf(exported["rules"], { name, origin, useFor, lists: lexicons.lists });
  const styles = stylesOf(exported["styles"], name, problem);
  const problems = [...rules.problems, ...lexicons.problems, ...styles.problems];
  if (problems.length > 0) return { plugin: undefined, problems };
  const plugin = { name, written: origin.written, rules: rules.rules, detectors: rules.detectors, lexicons: lexicons.lexicons, styles: styles.styles };
  return { plugin, problems: [] };
};
