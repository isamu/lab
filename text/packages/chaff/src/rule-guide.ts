import type { Localized } from "./plugin.ts";

/** How the rule reference groups rules for a reader who is not an engineer, in the order it lists them. */
export const RULE_GROUPS = ["readability", "wording", "slips", "consistency", "structure", "facts", "ai-tells", "team"] as const;

export type RuleGroup = (typeof RULE_GROUPS)[number];

/** A group's name and one line on what is in it, as the reference and chaff rules show them. */
export type GroupText = { readonly name: string; readonly note: string };

const GROUP_TEXT: Readonly<Record<"ja" | "en", Readonly<Record<RuleGroup, GroupText>>>> = {
  ja: {
    readability: { name: "読みやすさ", note: "長すぎる文、詰めすぎた段落、読み手がつまずく書き方。" },
    wording: { name: "言葉づかい", note: "中身を言わずに強める言い方、決まり文句、誰がしたのかを書かない受け身。" },
    slips: { name: "書き損じ", note: "書き換えの途中で残った語や空白。" },
    consistency: {
      name: "表記の揃え",
      note: "どちらで書いても正しいものが、一つの文書の中で混ざっている所。chaff はどちらが正しいかを決めず、少ないほうを指します。",
    },
    structure: { name: "構造", note: "番号の抜け、無い条への参照、同じ語の二重定義、長い前置き。" },
    facts: { name: "事実の食い違い", note: "日付と曜日、日付の順番、合計と内訳のように、暦や計算で確かめられる食い違い。" },
    "ai-tells": {
      name: "AIっぽさ",
      note: "生成された文章にありがちな特徴。どれも、それだけで生成されたとは言いません。読み返す場所の目印です。",
    },
    team: {
      name: "チームの表記",
      note: "chaff.yaml にチームが書いた表記・社内用語・必須の見出しだけを見るルール。書かなければ何も言いません。",
    },
  },
  en: {
    readability: { name: "Readability", note: "Sentences that run too long, packed paragraphs, and other places a reader stumbles." },
    wording: { name: "Wording", note: "Emphasis that says nothing, stock phrases, and passives that never say who acted." },
    slips: { name: "Slips", note: "Words and spaces left over from an edit." },
    consistency: {
      name: "Consistency",
      note: "Two ways of writing that are both right, mixed in one document. chaff does not pick a side; it points at whichever the document uses less.",
    },
    structure: {
      name: "Structure",
      note: "Skipped numbers, references to provisions that are not there, terms defined twice, long preambles.",
    },
    facts: {
      name: "Facts that disagree",
      note: "A date and its weekday, dates out of order, a total and its items: disagreements a calendar or a sum can settle.",
    },
    "ai-tells": {
      name: "Signs of generated text",
      note: "Traits common in generated text. None of them alone says the text was generated; they mark places to reread.",
    },
    team: {
      name: "Your team's words",
      note: "Rules that check only what your team lists in chaff.yaml: spellings, jargon, required headings. With nothing listed, they say nothing.",
    },
  },
};

/** In Japanese for "ja", in English for any other language. */
export const groupTextOf = (language: string, group: RuleGroup): GroupText => GROUP_TEXT[language === "ja" ? "ja" : "en"][group];

/**
 * A short text the rule flags and the same text fixed, with the chaff.yaml it needs (jargon, prefer, a level).
 * pad: the rule measures a whole document of some length (per 1000 words), so the example is tried after an ordinary passage.
 * other: a rule that compares documents (requires: [documents]) is tried with this third file in the same run.
 */
export type RuleExample = {
  readonly before: string;
  readonly after: string;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly pad?: boolean;
  readonly other?: string;
};

/** One finding of the rule itself on its example, as the command line reported it. */
export type ExampleFinding = { readonly line: number; readonly column: number; readonly message: string };

/** What the command line said about a rule on its example, before and after the fix (scripts/rule-examples.ts). */
export type ExampleOutcome = {
  readonly rule: string;
  readonly language: string;
  readonly before: readonly ExampleFinding[];
  readonly after: readonly ExampleFinding[];
};

/** One spot written the way the rule flags it, and the same spot rewritten without adding a fact. */
export type RewritePair = { readonly before: string; readonly after: string };

/**
 * How to rewrite a spot the rule flags, for an AI or a person doing the fix (chaff fix-plan prints it).
 * direction: what to do; keep: what must not change; avoid: the mistakes a rewriter makes here.
 */
export type RuleRewrite = {
  readonly direction: string;
  readonly pairs: readonly RewritePair[];
  readonly keep: readonly string[];
  readonly avoid: readonly string[];
};

/** The plain-language part of a rule file: what the reference tells a reader, apart from the texts chaff prints. */
export type RuleGuide = {
  readonly group: RuleGroup | undefined;
  /** What the rule finds, in one line. */
  readonly summary: Localized;
  /** By language. A rule that runs in one language has an example in that language only. */
  readonly examples: Readonly<Record<string, RuleExample>>;
  /** What the rule leaves alone on purpose, so a reader does not take silence for a miss. */
  readonly notFlagged: Localized;
  /** What a level's number means, with {limit} for the number ("一文 {limit} 字まで"). None when every level is the same. */
  readonly levelMeaning: Localized;
  /** The bibliography entries the rule rests on: the anchors of site/src/content/guide/{ja,en}/bibliography.md. */
  readonly sources: readonly string[];
  /** By language, optional per rule. */
  readonly rewrite: Readonly<Record<string, RuleRewrite>>;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

const localizedOf = (value: unknown): Localized =>
  isRecord(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => isText(entry[1]))) : {};

const exampleOf = (value: unknown): RuleExample | undefined => {
  if (!isRecord(value) || !isText(value["before"]) || !isText(value["after"])) return undefined;
  const config = value["config"];
  return {
    before: value["before"],
    after: value["after"],
    ...(isRecord(config) ? { config } : {}),
    ...(value["pad"] === true ? { pad: true } : {}),
    ...(isText(value["other"]) ? { other: value["other"] } : {}),
  };
};

const examplesOf = (value: unknown): Readonly<Record<string, RuleExample>> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).flatMap(([language, entry]) => {
          const example = exampleOf(entry);
          return example === undefined ? [] : [[language, example] as const];
        }),
      )
    : {};

const textsOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter(isText) : []);

const pairOf = (value: unknown): RewritePair[] =>
  isRecord(value) && isText(value["before"]) && isText(value["after"]) ? [{ before: value["before"], after: value["after"] }] : [];

/** A block that is written reads field by field; what is missing reads as empty, and the test on rule files names it. */
const rewriteOf = (value: Readonly<Record<string, unknown>>): RuleRewrite => ({
  direction: isText(value["direction"]) ? value["direction"] : "",
  pairs: Array.isArray(value["pairs"]) ? value["pairs"].flatMap(pairOf) : [],
  keep: textsOf(value["keep"]),
  avoid: textsOf(value["avoid"]),
});

const rewritesOf = (value: unknown): Readonly<Record<string, RuleRewrite>> =>
  isRecord(value)
    ? Object.fromEntries(Object.entries(value).flatMap(([language, entry]) => (isRecord(entry) ? [[language, rewriteOf(entry)] as const] : [])))
    : {};

/** A field that is missing or malformed reads as empty; the test on rule files names what a rule lacks. */
export const ruleGuideOf = (raw: Readonly<Record<string, unknown>>): RuleGuide => ({
  group: RULE_GROUPS.find((group) => group === raw["group"]),
  summary: localizedOf(raw["summary"]),
  examples: examplesOf(raw["example"]),
  notFlagged: localizedOf(raw["not_flagged"]),
  levelMeaning: localizedOf(raw["level_meaning"]),
  sources: textsOf(raw["sources"]),
  rewrite: rewritesOf(raw["rewrite"]),
});

/** The rules in each group, in the order the reference lists them. A rule with no group is in none, which the test on rule files reports. */
export const rulesByGroup = <T>(rules: readonly T[], groupOf: (rule: T) => RuleGroup | undefined): { group: RuleGroup; rules: T[] }[] =>
  RULE_GROUPS.map((group) => ({ group, rules: rules.filter((rule) => groupOf(rule) === group) }));
