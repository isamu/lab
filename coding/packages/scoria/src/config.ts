import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isRecord, readPackageJson } from "./package-json.ts";
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
  /** Language of the terminal output. Machine output stays English (see messages.ts). */
  readonly lang: Lang;
}

/** Stacks the config and the current detection disagree about. Formatted by the renderer. */
export interface Drift {
  readonly added: readonly string[];
  readonly missing: readonly string[];
}

export type ConfigSource = "config-file" | "package-json" | "detected";

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

const toConfig = (raw: unknown): ScoriaConfig | undefined => {
  if (!isRecord(raw) || !isProfile(raw["profile"]) || !isStringArray(raw["stacks"])) return undefined;
  const lang = raw["lang"];
  const mode = raw["mode"];
  return { profile: raw["profile"], stacks: raw["stacks"], mode: isMode(mode) ? mode : "report", lang: isLang(lang) ? lang : "en" };
};

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

export const loadConfig = async (root: string): Promise<LoadedConfig> => {
  const detected = await detectConfig(root);
  const fromFile = await readConfigFile(root);
  const fromPackage = toConfig((await readPackageJson(root))?.["scoria"]);
  const stored = fromFile ?? fromPackage;
  if (stored === undefined) {
    return { config: detected, source: "detected", frozen: false, drift: { added: [], missing: [] } };
  }
  return {
    config: stored,
    source: fromFile === undefined ? "package-json" : "config-file",
    frozen: true,
    drift: driftOf(stored, detected.stacks),
  };
};

export const writeConfig = async (root: string, config: ScoriaConfig): Promise<string> => {
  const path = join(root, CONFIG_FILENAME);
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return path;
};
