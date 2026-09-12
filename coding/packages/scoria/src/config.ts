import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isRecord, readPackageJson } from "./package-json.ts";
import { readRepoJson } from "./repo-json.ts";
import { detectStacks } from "./stacks/index.ts";
import { isLang, type Lang } from "./messages.ts";

export const CONFIG_FILENAME = "scoria.config.json";

export type Profile = "app" | "library" | "cli";

/**
 * What a run does with what it found (spec §17.2). `report` gates nothing and is where every
 * repository starts; `ratchet` fails the run when a dimension falls below its baseline.
 *
 * This is policy, not output, so it lives in the committed config rather than behind a flag —
 * turning the gate on is a decision a reviewer should see in a diff.
 */
export type Mode = "report" | "ratchet";

export interface ScoriaConfig {
  readonly profile: Profile;
  readonly stacks: readonly string[];
  readonly mode: Mode;
  /**
   * Directories to measure, as globs relative to this config (spec §9.3). Each is measured on its
   * own, with its own config and its own baseline. Empty means "the directory scoria was pointed
   * at", which is what a single-project repository wants.
   *
   * Only the invocation root's targets are honoured: a config found inside a target does not get
   * to name targets of its own.
   */
  readonly targets: readonly string[];
  /** Language of the terminal output. Machine output stays English (see messages.ts). */
  readonly lang: Lang;
}

/** Stacks the config and the current detection disagree about. Formatted by the renderer. */
export interface Drift {
  readonly added: readonly string[];
  readonly missing: readonly string[];
}

export type ConfigSource = "config-file" | "repo-json" | "package-json" | "detected";

export interface LoadedConfig {
  readonly config: ScoriaConfig;
  readonly source: ConfigSource;
  /** Whether the config is frozen. A run on bare detection cannot become a baseline (spec §9.2). */
  readonly frozen: boolean;
  /** Where the config and current detection disagree. Never followed silently. */
  readonly drift: Drift;
}

const isStringArray = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isProfile = (value: unknown): value is Profile => value === "app" || value === "library" || value === "cli";

const isMode = (value: unknown): value is Mode => value === "report" || value === "ratchet";

/**
 * `base` fills in what a source does not state. A `repo.json` extension saying only
 * `{ "targets": [...] }` is the point of the field: a repository should not have to restate its
 * stacks to say where its units are.
 */
const toConfig = (raw: unknown, base?: ScoriaConfig): ScoriaConfig | undefined => {
  if (!isRecord(raw)) return undefined;
  const profile = isProfile(raw["profile"]) ? raw["profile"] : base?.profile;
  const stacks = isStringArray(raw["stacks"]) ? raw["stacks"] : base?.stacks;
  if (profile === undefined || stacks === undefined) return undefined;
  const lang = raw["lang"];
  const mode = raw["mode"];
  const targets = raw["targets"];
  return { profile, stacks, mode: modeOf(mode, base), targets: targetsOf(targets, base), lang: langOf(lang, base) };
};

const modeOf = (value: unknown, base: ScoriaConfig | undefined): Mode => (isMode(value) ? value : (base?.mode ?? "report"));

const targetsOf = (value: unknown, base: ScoriaConfig | undefined): readonly string[] => (isStringArray(value) ? value : (base?.targets ?? []));

const langOf = (value: unknown, base: ScoriaConfig | undefined): Lang => (isLang(value) ? value : (base?.lang ?? "en"));

const detectProfile = (pkg: unknown): Profile => {
  if (!isRecord(pkg)) return "app";
  if (isRecord(pkg["bin"]) || typeof pkg["bin"] === "string") return "cli";
  const publishable = pkg["private"] !== true && (pkg["exports"] !== undefined || pkg["main"] !== undefined);
  return publishable ? "library" : "app";
};

export const detectConfig = async (root: string): Promise<ScoriaConfig> => ({
  profile: detectProfile(await readPackageJson(root)),
  stacks: await detectStacks(root),
  mode: "report",
  targets: [],
  lang: "en",
});

const readConfigFile = async (root: string): Promise<ScoriaConfig | undefined> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(root, CONFIG_FILENAME), "utf8"));
    return toConfig(parsed);
  } catch {
    return undefined;
  }
};

const driftOf = (config: ScoriaConfig, detected: readonly string[]): Drift => ({
  added: detected.filter((id) => !config.stacks.includes(id)),
  missing: config.stacks.filter((id) => !detected.includes(id)),
});

/**
 * `repo.json` §10: a consumer's own per-repository configuration sits above what the repository says
 * to every tool, and `repo.json` in turn beats the ecosystem manifest — it was written for this.
 */
const sourcesOf = async (root: string, detected: ScoriaConfig): Promise<readonly (readonly [ConfigSource, ScoriaConfig | undefined])[]> => {
  const repoJson = await readRepoJson(root);
  // §9: `projects` is what the repository tells every tool, so it is where targets come from when
  // scoria has not been told otherwise.
  const declared = { ...detected, targets: repoJson.projects.map((entry) => entry.path) };
  const fromRepoJson = toConfig(repoJson.extensions["scoria"], declared);
  return [
    ["config-file", await readConfigFile(root)],
    ["repo-json", fromRepoJson ?? (repoJson.projects.length > 0 ? declared : undefined)],
    ["package-json", toConfig((await readPackageJson(root))?.["scoria"])],
  ];
};

/**
 * `base` is what the run was configured with at the invocation root. A target states what it wants
 * to differ; everything else it inherits, so `mode: ratchet` set once at the root is not silently
 * ignored by every directory it names. `targets` is never inherited — that would recurse.
 */
export const loadConfig = async (root: string, base?: ScoriaConfig): Promise<LoadedConfig> => {
  const inherited = base === undefined ? undefined : { ...base, targets: [] };
  const detected = { ...(await detectConfig(root)), ...(inherited === undefined ? {} : { mode: inherited.mode, lang: inherited.lang }) };
  const found = (await sourcesOf(root, detected)).find(([, config]) => config !== undefined);
  if (found === undefined) {
    return { config: detected, source: "detected", frozen: false, drift: { added: [], missing: [] } };
  }
  const [source, config] = found;
  if (config === undefined) {
    return { config: detected, source: "detected", frozen: false, drift: { added: [], missing: [] } };
  }
  return { config, source, frozen: true, drift: driftOf(config, detected.stacks) };
};

export const writeConfig = async (root: string, config: ScoriaConfig): Promise<string> => {
  const path = join(root, CONFIG_FILENAME);
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return path;
};
