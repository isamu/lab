import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { isLevel } from "../levels.ts";
import type { Level } from "../plugin.ts";

export const CONFIG_FILE = "chaff.yaml";

export type Config = {
  readonly genre: string | undefined;
  readonly language: string | undefined;
  readonly rules: Readonly<Record<string, Level>>;
  readonly experimental: boolean;
  readonly path: string | undefined;
  readonly aiModel: string;
  readonly confidenceThreshold: number;
};

/** 判定の質が誤検知に直結するので、既定は最上位のモデル。cost は絞り込みで削る。spec §14。 */
export const DEFAULT_MODEL = "claude-opus-5";

export const EMPTY: Config = {
  genre: undefined,
  language: undefined,
  rules: {},
  experimental: false,
  path: undefined,
  aiModel: DEFAULT_MODEL,
  confidenceThreshold: 0.7,
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const rulesOf = (raw: unknown): Record<string, Level> => {
  if (!isRecord(raw)) return {};
  return Object.entries(raw).reduce<Record<string, Level>>((acc, [id, value]) => (isLevel(value) ? { ...acc, [id]: value } : acc), {});
};

const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/** 設定ファイルが無くても動く。あっても、既定から変えたものだけが書かれている。spec §18。 */
export const loadConfig = (path: string): Config => {
  const raw: unknown = parse(readFileSync(path, "utf8"));
  if (!isRecord(raw)) return { ...EMPTY, path };
  return {
    genre: str(raw["genre"]),
    language: str(raw["language"]),
    rules: rulesOf(raw["rules"]),
    experimental: raw["experimental"] === true,
    path,
    aiModel: str(raw["ai_model"]) ?? DEFAULT_MODEL,
    confidenceThreshold: typeof raw["confidence_threshold"] === "number" ? raw["confidence_threshold"] : 0.7,
  };
};
