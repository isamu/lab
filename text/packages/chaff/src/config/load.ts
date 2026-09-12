import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { parse } from "yaml";
import { isLevel } from "../levels.ts";
import { defaultModel } from "../judge.ts";
import { isBackend, type BackendName } from "../backends/types.ts";
import type { Level } from "../plugin.ts";
import type { PathRule } from "./by-path.ts";

export const CONFIG_FILE = "chaff.yaml";

export type Config = {
  readonly genre: string | undefined;
  readonly aiBackend: BackendName;
  readonly language: string | undefined;
  readonly rules: Readonly<Record<string, Level>>;
  readonly experimental: boolean;
  readonly path: string | undefined;
  readonly aiModel: string;
  readonly confidenceThreshold: number;
  /** チームの言葉。社内でしか通じない語を、チームが自分で並べる。 */
  readonly jargon: readonly string[];
  /** この種類の文書に無いと困る見出し。チームが自分で決める。 */
  readonly requiredSections: readonly string[];
  /** パスごとの上書き。設定ファイルのある場所からの相対で照合する。 */
  readonly byPath: readonly PathRule[];
  readonly baseDir: string;
};

/** 判定の質が誤検知に直結するので、既定は最上位のモデル。cost は絞り込みで削る。spec §14。 */
/** 既定は Anthropic。openai にすると判定役だけが替わり、rule も判定の形も変わらない。 */
export const DEFAULT_BACKEND: BackendName = "anthropic";

export const EMPTY: Config = {
  genre: undefined,
  language: undefined,
  rules: {},
  experimental: false,
  path: undefined,
  aiBackend: DEFAULT_BACKEND,
  aiModel: defaultModel(DEFAULT_BACKEND),
  confidenceThreshold: 0.7,
  jargon: [],
  requiredSections: [],
  byPath: [],
  baseDir: process.cwd(),
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const rulesOf = (raw: unknown): Record<string, Level> => {
  if (!isRecord(raw)) return {};
  return Object.entries(raw).reduce<Record<string, Level>>((acc, [id, value]) => (isLevel(value) ? { ...acc, [id]: value } : acc), {});
};

const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/** files は 1 つの文字列でも配列でも書ける。 */
const globsOf = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
};

const toPathRule = (raw: unknown): PathRule | undefined => {
  if (!isRecord(raw)) return undefined;
  const files = raw["files"];
  const globs = globsOf(files);
  if (globs.length === 0) return undefined;
  return { files: globs, genre: str(raw["genre"]), language: str(raw["language"]) };
};

/** 利用者が書く語の並び。空白だけのものは落とす。 */
const wordsOf = (raw: unknown): string[] => (Array.isArray(raw) ? raw.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0) : []);

const byPathOf = (raw: unknown): PathRule[] => (Array.isArray(raw) ? raw.map(toPathRule).filter((rule) => rule !== undefined) : []);

/** 設定ファイルが無くても動く。あっても、既定から変えたものだけが書かれている。spec §18。 */
export const loadConfig = (path: string): Config => {
  const raw: unknown = parse(readFileSync(path, "utf8"));
  if (!isRecord(raw)) return { ...EMPTY, path };
  const declared: unknown = raw["ai_backend"];
  const backend: BackendName = isBackend(declared) ? declared : DEFAULT_BACKEND;
  return {
    genre: str(raw["genre"]),
    language: str(raw["language"]),
    rules: rulesOf(raw["rules"]),
    experimental: raw["experimental"] === true,
    path,
    aiBackend: backend,
    aiModel: str(raw["ai_model"]) ?? defaultModel(backend),
    confidenceThreshold: typeof raw["confidence_threshold"] === "number" ? raw["confidence_threshold"] : 0.7,
    jargon: wordsOf(raw["jargon"]),
    requiredSections: wordsOf(raw["required_sections"]),
    byPath: byPathOf(raw["by_path"]),
    baseDir: dirname(path),
  };
};
