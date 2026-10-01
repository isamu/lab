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
  /** 文書の種類（profiles/*.yaml の id）。none なら内容からも選ばない。 */
  readonly profile: string | undefined;
  readonly aiBackend: BackendName;
  readonly language: string | undefined;
  readonly rules: Readonly<Record<string, Level>>;
  /** rules に数値で書いた上限。段階の 4 語では足りないときに、その rule の数値を直接決める。段階は normal として扱う。 */
  readonly limits: Readonly<Record<string, number>>;
  /** rules に書かれていたが読めなかった値。黙って捨てると、書いた設定が効いていないことに気づけない。 */
  readonly unreadableRules: readonly { readonly id: string; readonly value: string }[];
  readonly experimental: boolean;
  readonly path: string | undefined;
  readonly aiModel: string;
  readonly confidenceThreshold: number;
  /** チームの言葉。社内でしか通じない語を、チームが自分で並べる。 */
  readonly jargon: readonly string[];
  /** チームの表記。{ 使わない書き方: 使う書き方 }。「サーバー」ではなく「サーバ」、のように。 */
  readonly prefer: Readonly<Record<string, string>>;
  /** この種類の文書に無いと困る見出し。チームが自分で決める。 */
  readonly requiredSections: readonly string[];
  /** チームの固有名詞（組織名・製品名）。1 つの名前として読み、漢字の連なりや繰り返しに数えない。 */
  readonly names: readonly string[];
  /** names に書かれていたが名前として読めなかった値。黙って捨てると、並べたつもりの名前が効いていないことに気づけない。 */
  readonly unreadableNames: readonly string[];
  /** パスごとの上書き。設定ファイルのある場所からの相対で照合する。 */
  readonly byPath: readonly PathRule[];
  readonly baseDir: string;
  /** Options set on rules that take them: { rule id: { option: value } }, as written. rule-options.ts checks them against the rules. */
  readonly options?: Readonly<Record<string, unknown>>;
  /** options as written when it is not a map. Dropping it silently would leave a team thinking its options apply. */
  readonly unreadableOptions?: string | undefined;
  /** The house style chaff.yaml names (styles/*.yaml), as written. A value that is not a name is kept printed, to be reported. */
  readonly style?: string | undefined;
  /** The style once applied (config/style.ts): its id, the rules whose level it decided, and its options. */
  readonly applied?: AppliedStyle | undefined;
};

export type AppliedStyle = {
  readonly style: string;
  readonly levelsFrom: readonly string[];
  readonly options: Readonly<Record<string, unknown>>;
};

/** 判定の質が誤検知に直結するので、既定は最上位のモデル。cost は絞り込みで削る。spec §14。 */
/** 既定は Anthropic。openai にすると判定役だけが替わり、rule も判定の形も変わらない。 */
const DEFAULT_BACKEND: BackendName = "anthropic";

export const EMPTY: Config = {
  genre: undefined,
  profile: undefined,
  language: undefined,
  rules: {},
  limits: {},
  unreadableRules: [],
  experimental: false,
  path: undefined,
  aiBackend: DEFAULT_BACKEND,
  aiModel: defaultModel(DEFAULT_BACKEND),
  confidenceThreshold: 0.7,
  jargon: [],
  prefer: {},
  requiredSections: [],
  names: [],
  unreadableNames: [],
  byPath: [],
  baseDir: process.cwd(),
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isLimit = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

/** 段階の 4 語はそのまま、数値の上限は normal として読む。上限そのものは limitsOf が持つ。 */
const rulesOf = (raw: unknown): Record<string, Level> => {
  if (!isRecord(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).flatMap(([id, value]): [string, Level][] => {
      if (isLevel(value)) return [[id, value]];
      return isLimit(value) ? [[id, "normal"]] : [];
    }),
  );
};

const limitsOf = (raw: unknown): Record<string, number> =>
  isRecord(raw) ? Object.fromEntries(Object.entries(raw).flatMap(([id, value]): [string, number][] => (isLimit(value) ? [[id, value]] : []))) : {};

const unreadableOf = (raw: unknown): { id: string; value: string }[] =>
  isRecord(raw)
    ? Object.entries(raw)
        .filter(([, value]) => !isLevel(value) && !isLimit(value))
        .map(([id, value]) => ({ id, value: JSON.stringify(value) ?? String(value) }))
    : [];

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
  return { files: globs, genre: str(raw["genre"]), language: str(raw["language"]), profile: str(raw["profile"]) };
};

/** 利用者が書く語の並び。空白だけのものは落とす。 */
const wordsOf = (raw: unknown): string[] => (Array.isArray(raw) ? raw.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0) : []);

/** 両側とも空でない文字列の対だけを読む。同じ語どうし（「サーバ: サーバ」）は何も言えないので捨てる。 */
const preferOf = (raw: unknown): Record<string, string> =>
  isRecord(raw)
    ? Object.fromEntries(
        Object.entries(raw).flatMap(([avoid, use]): [string, string][] => {
          const from = avoid.trim();
          const to = typeof use === "string" ? use.trim() : "";
          return from !== "" && to !== "" && from !== to ? [[from, to]] : [];
        }),
      )
    : {};

const isNameEntry = (value: unknown): value is string | number => typeof value === "string" || typeof value === "number";

const printed = (value: unknown): string => JSON.stringify(value) ?? String(value);

/** 名前は文字列か数（2025 のような名前）の並び。並びでない値と、並びの中の名前でない項目は読めないものとして返す。 */
const namesOf = (raw: unknown): { readonly names: string[]; readonly unreadable: string[] } => {
  if (raw === undefined || raw === null) return { names: [], unreadable: [] };
  if (!Array.isArray(raw)) return { names: [], unreadable: [printed(raw)] };
  const entries: unknown[] = raw;
  return {
    names: wordsOf(entries.filter(isNameEntry)),
    unreadable: entries.filter((entry) => !isNameEntry(entry)).map(printed),
  };
};

const byPathOf = (raw: unknown): PathRule[] => (Array.isArray(raw) ? raw.map(toPathRule).filter((rule) => rule !== undefined) : []);

/** 設定ファイルが無くても動く。あっても、既定から変えたものだけが書かれている。spec §18。 */
export const loadConfig = (path: string): Config => {
  const raw: unknown = parse(readFileSync(path, "utf8"));
  if (!isRecord(raw)) return { ...EMPTY, path };
  const declared: unknown = raw["ai_backend"];
  const backend: BackendName = isBackend(declared) ? declared : DEFAULT_BACKEND;
  const names = namesOf(raw["names"]);
  const options: unknown = raw["options"];
  return {
    genre: str(raw["genre"]),
    profile: str(raw["profile"]),
    language: str(raw["language"]),
    rules: rulesOf(raw["rules"]),
    limits: limitsOf(raw["rules"]),
    unreadableRules: unreadableOf(raw["rules"]),
    experimental: raw["experimental"] === true,
    path,
    aiBackend: backend,
    aiModel: str(raw["ai_model"]) ?? defaultModel(backend),
    confidenceThreshold: typeof raw["confidence_threshold"] === "number" ? raw["confidence_threshold"] : 0.7,
    jargon: wordsOf(raw["jargon"]),
    prefer: preferOf(raw["prefer"]),
    requiredSections: wordsOf(raw["required_sections"]),
    names: names.names,
    unreadableNames: names.unreadable,
    byPath: byPathOf(raw["by_path"]),
    baseDir: dirname(path),
    options: isRecord(options) ? options : {},
    unreadableOptions: options === undefined || options === null || isRecord(options) ? undefined : printed(options),
    style: raw["style"] === undefined || raw["style"] === null ? undefined : (str(raw["style"]) ?? printed(raw["style"])),
  };
};
