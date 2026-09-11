import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isRecord, readPackageJson } from "./package-json.ts";
import { detectStacks } from "./stacks/index.ts";

export const CONFIG_FILENAME = "scoria.config.json";

export type Profile = "app" | "library" | "cli";

export interface ScoriaConfig {
  readonly profile: Profile;
  readonly stacks: readonly string[];
  readonly mode: "report";
}

export type ConfigSource = "config-file" | "package-json" | "detected";

export interface LoadedConfig {
  readonly config: ScoriaConfig;
  readonly source: ConfigSource;
  /** 設定が凍結されているか。検出のままの run は baseline にできない（spec §9.2）。 */
  readonly frozen: boolean;
  /** 設定と、いま検出した結果のずれ。勝手に追随しない。 */
  readonly drift: readonly string[];
}

const isStringArray = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isProfile = (value: unknown): value is Profile => value === "app" || value === "library" || value === "cli";

const toConfig = (raw: unknown): ScoriaConfig | undefined => {
  if (!isRecord(raw) || !isProfile(raw["profile"]) || !isStringArray(raw["stacks"])) return undefined;
  return { profile: raw["profile"], stacks: raw["stacks"], mode: "report" };
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
});

const readConfigFile = async (root: string): Promise<ScoriaConfig | undefined> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(root, CONFIG_FILENAME), "utf8"));
    return toConfig(parsed);
  } catch {
    return undefined;
  }
};

const driftOf = (config: ScoriaConfig, detected: readonly string[]): readonly string[] => {
  const added = detected.filter((id) => !config.stacks.includes(id)).map((id) => `${id} が増えています`);
  const gone = config.stacks.filter((id) => !detected.includes(id)).map((id) => `${id} が見つかりません`);
  return [...added, ...gone];
};

export const loadConfig = async (root: string): Promise<LoadedConfig> => {
  const detected = await detectConfig(root);
  const fromFile = await readConfigFile(root);
  const fromPackage = toConfig((await readPackageJson(root))?.["scoria"]);
  const stored = fromFile ?? fromPackage;
  if (stored === undefined) return { config: detected, source: "detected", frozen: false, drift: [] };
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
