import { dirname } from "node:path";
import { workingDir } from "./working-dir.ts";
import { isLevel } from "../levels.ts";
import { defaultModel } from "../backends/default-model.ts";
import { isBackend, type BackendName } from "../backends/types.ts";
import type { Level, ScopeSelector } from "../plugin.ts";
import { preferOf, type PreferProblem } from "./prefer.ts";
import type { PathRule } from "./by-path.ts";
import type { Extensions } from "../extension/load.ts";
import type { StyleLimits } from "../style-parse.ts";
import type { GuideLayer } from "../genre-guide/layer.ts";
import type { OptionLayer } from "../rule-options.ts";

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
  /** prefer's entries written in the object form with a scope: { avoid: the parts of the document the entry counts in }. */
  readonly preferScopes?: Readonly<Record<string, ScopeSelector>>;
  /** prefer's entries that could not be read (an object without use, a scope that cannot be read). Each stops the run. */
  readonly unreadablePrefer?: readonly PreferProblem[];
  /** この種類の文書に無いと困る見出し。チームが自分で決める。 */
  readonly requiredSections: readonly string[];
  /** チームの固有名詞（組織名・製品名）。1 つの名前として読み、漢字の連なりや繰り返しに数えない。 */
  readonly names: readonly string[];
  /** names に書かれていたが名前として読めなかった値。黙って捨てると、並べたつもりの名前が効いていないことに気づけない。 */
  readonly unreadableNames: readonly string[];
  /** The team's groups of words that are each right but must not be mixed in one document ([顧客, お客様]). term-consistency reads them. */
  readonly consistent?: readonly (readonly string[])[];
  /** consistent as written that cannot be read as a group: not a list, or an entry that is not two or more different words. */
  readonly unreadableConsistent?: readonly string[];
  /** File-name globs (*.yaml) a directory walk checks besides Markdown. --include adds to them. */
  readonly include?: readonly string[];
  /** Globs a directory walk leaves out, matched from chaff.yaml's folder as by_path is. A file named on the command line is still checked. */
  readonly exclude?: readonly string[];
  /** パスごとの上書き。設定ファイルのある場所からの相対で照合する。 */
  readonly byPath: readonly PathRule[];
  /** by_path entries that could not be read (a map instead of a list, an entry without files), as written. */
  readonly unreadableByPath?: readonly string[];
  readonly baseDir: string;
  /** Set only on the settings one file is checked with (by-path-rules.ts): for each rule a by_path entry set, which entry. */
  readonly pathLevelsFrom?: Readonly<Record<string, string>>;
  /** Set only on the settings one file is checked with: the matching by_path entries' options, strongest first. */
  readonly pathOptionLayers?: readonly OptionLayer[];
  /** Options set on rules that take them: { rule id: { option: value } }, as written. rule-options.ts checks them against the rules. */
  readonly options?: Readonly<Record<string, unknown>>;
  /** options as written when it is not a map. Dropping it silently would leave a team thinking its options apply. */
  readonly unreadableOptions?: string | undefined;
  /** The house style chaff.yaml names (styles/*.yaml), as written. A value that is not a name is kept printed, to be reported. */
  readonly style?: string | undefined;
  /** The style once applied (config/style.ts): its id, the rules whose level it decided, its options and its guide. */
  readonly applied?: AppliedStyle | undefined;
  /** custom_rules as written: the team's own rules. custom/parse.ts reads and checks them. */
  readonly customRules?: unknown;
  /** grade as written: the rubric `chaff grade` reads (grade/rubric.ts). */
  readonly grade?: unknown;
  /** fix_plan as written: the depth chaff fix-plan rewrites to (fix-plan/chosen-depth.ts reads and checks it). */
  readonly fixPlan?: unknown;
  /** guide as written: the team's changes to the genre guides, or off (genre-guide/of-config.ts reads it). */
  readonly guide?: unknown;
  /** plugins as written: package names and paths. extension/plugin-load.ts reads and checks them. */
  readonly plugins?: unknown;
  /** The code chaff.yaml names, once loaded (extension/load.ts). Reading chaff.yaml does not load it. */
  readonly extensions?: Extensions;
};

export type AppliedStyle = {
  readonly style: string;
  readonly levelsFrom: readonly string[];
  readonly options: Readonly<Record<string, unknown>>;
  /** The style's numbers, by rule and language, for the rules whose level it decided. */
  readonly limits: StyleLimits;
  /** The style's changes to the genre guides, when it has any. */
  readonly guide?: GuideLayer | undefined;
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
  baseDir: workingDir(),
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

const PATH_BLOCKS: readonly ("rules" | "options")[] = ["rules", "options"];

/** rules: or options: under a by_path entry that is written but is not a map: it changes nothing, so it is reported. */
const unreadableBlocksOf = (raw: Record<string, unknown>): { key: "rules" | "options"; value: string }[] =>
  PATH_BLOCKS.flatMap((key) => {
    const value = raw[key];
    return value === undefined || value === null || isRecord(value) ? [] : [{ key, value: printed(value) }];
  });

/** An entry's rules: and options:, read as the top-level ones are. Nothing is added for an entry that writes neither. */
const pathRuleSettingsOf = (raw: Record<string, unknown>): Pick<PathRule, "rules" | "limits" | "unreadableRules" | "options" | "unreadableBlocks"> => {
  const written = (key: string): boolean => raw[key] !== undefined && raw[key] !== null;
  const blocks = unreadableBlocksOf(raw);
  const options = raw["options"];
  return {
    ...(written("rules") ? { rules: rulesOf(raw["rules"]), limits: limitsOf(raw["rules"]), unreadableRules: unreadableOf(raw["rules"]) } : {}),
    ...(written("options") ? { options: isRecord(options) ? options : {} } : {}),
    ...(blocks.length === 0 ? {} : { unreadableBlocks: blocks }),
  };
};

const toPathRule = (raw: unknown): PathRule | undefined => {
  if (!isRecord(raw)) return undefined;
  const files = raw["files"];
  const globs = globsOf(files);
  if (globs.length === 0) return undefined;
  return { files: globs, genre: str(raw["genre"]), language: str(raw["language"]), profile: str(raw["profile"]), ...pathRuleSettingsOf(raw) };
};

/** 利用者が書く語の並び。空白だけのものは落とす。 */
const wordsOf = (raw: unknown): string[] => (Array.isArray(raw) ? raw.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0) : []);

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

/** A group: a list of two or more different words (a number reads as text, as under names). */
const groupOf = (entry: unknown): string[] | undefined => {
  if (!Array.isArray(entry)) return undefined;
  const members: unknown[] = entry;
  const words = wordsOf(members);
  return members.every(isNameEntry) && words.length === members.length && new Set(words).size === words.length && words.length >= 2 ? words : undefined;
};

/** consistent is a list of groups. A value that is not a list, and an entry that is not a group, are kept printed to be reported. */
const consistentOf = (raw: unknown): { readonly groups: string[][]; readonly unreadable: string[] } => {
  if (raw === undefined || raw === null) return { groups: [], unreadable: [] };
  if (!Array.isArray(raw)) return { groups: [], unreadable: [printed(raw)] };
  const entries: unknown[] = raw;
  const read = entries.map((entry) => ({ entry, group: groupOf(entry) }));
  return {
    groups: read.flatMap(({ group }) => (group === undefined ? [] : [group])),
    unreadable: read.filter(({ group }) => group === undefined).map(({ entry }) => printed(entry)),
  };
};

/** by_path は files を持つ項目の並び。並びでない値と、読めない項目は読めないものとして返す。黙って捨てると、書いた人は効いたつもりでいる。 */
export const byPathOf = (raw: unknown): { readonly rules: PathRule[]; readonly unreadable: string[] } => {
  if (raw === undefined || raw === null) return { rules: [], unreadable: [] };
  if (!Array.isArray(raw)) return { rules: [], unreadable: [printed(raw)] };
  const entries: unknown[] = raw;
  const read = entries.map((entry) => ({ entry, rule: toPathRule(entry) }));
  return {
    rules: read.flatMap(({ rule }) => (rule === undefined ? [] : [rule])),
    unreadable: read.filter(({ rule }) => rule === undefined).map(({ entry }) => printed(entry)),
  };
};

/** 読んだ chaff.yaml の中身（raw）を設定にする。ファイルは読まない。path は raw を読んだ場所。 */
export const configOf = (raw: unknown, path: string): Config => {
  if (!isRecord(raw)) return { ...EMPTY, path };
  const declared: unknown = raw["ai_backend"];
  const backend: BackendName = isBackend(declared) ? declared : DEFAULT_BACKEND;
  const names = namesOf(raw["names"]);
  const consistent = consistentOf(raw["consistent"]);
  const byPath = byPathOf(raw["by_path"]);
  const options: unknown = raw["options"];
  const prefer = preferOf(raw["prefer"]);
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
    prefer: prefer.prefer,
    preferScopes: prefer.scopes,
    unreadablePrefer: prefer.problems,
    requiredSections: wordsOf(raw["required_sections"]),
    names: names.names,
    unreadableNames: names.unreadable,
    consistent: consistent.groups,
    unreadableConsistent: consistent.unreadable,
    include: globsOf(raw["include"]),
    exclude: globsOf(raw["exclude"]),
    byPath: byPath.rules,
    unreadableByPath: byPath.unreadable,
    baseDir: dirname(path),
    options: isRecord(options) ? options : {},
    unreadableOptions: options === undefined || options === null || isRecord(options) ? undefined : printed(options),
    style: raw["style"] === undefined || raw["style"] === null ? undefined : (str(raw["style"]) ?? printed(raw["style"])),
    customRules: raw["custom_rules"],
    grade: raw["grade"],
    fixPlan: raw["fix_plan"],
    guide: raw["guide"],
    plugins: raw["plugins"],
  };
};
