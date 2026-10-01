import { definedLevels, resolve, severityAt } from "../levels.ts";
import { fill, localized, readableText } from "./text.ts";
import { SEVERITY_NAME } from "./severity-name.ts";
import { uiLanguageOf, type Texts } from "../ui.ts";
import type { Level, RuleDefinition } from "../plugin.ts";
import { optionLines } from "./options.ts";
import type { OptionLayer } from "../rule-options.ts";

const TEXT: Texts<{
  readonly off: string;
  readonly defaultGenre: string;
  readonly genreNote: (genre: string, others: string) => string;
  readonly experimental: string;
  readonly howToFix: string;
  readonly example: string;
  readonly definedIn: string;
  readonly values: string;
  readonly times: string;
  readonly severities: string;
  readonly now: (level: string) => string;
  readonly from: (source: string) => string;
  readonly change: (id: string) => string;
}> = {
  ja: {
    off: "見ない",
    defaultGenre: "既定",
    genreNote: (genre, others) => `この数字は ${genre} のものです。ほかに ${others} で別の数字を持っています。`,
    experimental: "このルールはまだ試験中で、既定では動きません（--experimental で動きます）。",
    howToFix: "直しかた",
    example: "例",
    definedIn: "このルールはチームが chaff.yaml の custom_rules で決めたものです。",
    values: "設定できる値:",
    times: "回",
    severities: "設定できる値（数える上限は無く、指摘の重さが変わります）:",
    now: (level) => `いまは ${level} です。`,
    from: (source) => `（${source} で決めています）`,
    change: (id) => `変える:  npx chaff relax ${id} --why "理由"`,
  },
  en: {
    off: "not checked",
    defaultGenre: "the default genre",
    genreNote: (genre, others) => `These numbers are for ${genre}. ${others} have numbers of their own.`,
    experimental: "This rule is still experimental and does not run by default (--experimental runs it).",
    howToFix: "How to fix",
    example: "Example",
    definedIn: "The team defined this rule under custom_rules in chaff.yaml.",
    values: "Levels:",
    times: "times",
    severities: "Levels (there is no limit to count to; a level sets how a finding is marked):",
    now: (level) => `Now: ${level}.`,
    from: (source) => ` (set by ${source})`,
    change: (id) => `Change it:  npx chaff relax ${id} --why "reason"`,
  },
};

/**
 * A limit in the rule's words for what it counts ("up to 8 emoji per 1000 words"), as the rule reference shows it.
 * A rule that says nothing (a team's custom rule) counts matches, so its limit is a number of times.
 */
const limitText = (rule: RuleDefinition, limit: number, language: string): string => {
  const meaning = localized(rule.guide?.levelMeaning ?? {}, language);
  return meaning === "" ? `${String(limit)} ${TEXT[uiLanguageOf(language)].times}` : fill(meaning, { limit });
};

/** What a level holds: the limit a detector counts to, or the severity a rule with nothing to count gives. */
const valueAt = (rule: RuleDefinition, level: Exclude<Level, "off">, genre: string | undefined, language: string): string =>
  rule.level_sets === "severity"
    ? SEVERITY_NAME[uiLanguageOf(language)][severityAt(rule, level, genre)]
    : limitText(rule, resolve(rule, level, genre).limit, language);

const levelLine = (rule: RuleDefinition, level: Level, current: Level, genre: string | undefined, language: string): string => {
  const mark = level === current ? "→" : " ";
  const name = level.padEnd(9);
  return level === "off" ? `  ${mark} ${name}${TEXT[uiLanguageOf(language)].off}` : `  ${mark} ${name}${valueAt(rule, level, genre, language)}`;
};

/** ジャンルで数字が変わる rule は、それを言わないと「設定したのに効かない」に見える。 */
const genreNote = (rule: RuleDefinition, genre: string | undefined, text: (typeof TEXT)["ja"]): string[] => {
  const others = Object.keys(rule.by_genre).filter((key) => key !== genre);
  if (others.length === 0) return [];
  return ["", `  ${text.genreNote(genre ?? text.defaultGenre, others.join(" / "))}`];
};

/** A team's rule shows its example, before and after, and says where it was defined. */
const exampleLines = (rule: RuleDefinition, language: string, text: (typeof TEXT)["ja"]): string[] => {
  const examples = rule.guide?.examples ?? {};
  const example = examples[language] ?? examples["en"] ?? Object.values(examples)[0];
  if (rule.custom === undefined || example === undefined) return [];
  return ["", `  ${text.example}:  ${example.before}`, `      →  ${example.after}`, "", `  ${text.definedIn}`];
};

/** Where the rule's settings come from: the option layers, strongest first, and the source of its level when a style set it. */
export type ExplainSettings = { readonly optionLayers?: readonly OptionLayer[]; readonly levelFrom?: string | undefined };

/** rule の意図と根拠を読む。指摘に納得できないときの入口。 */
export const renderExplain = (rule: RuleDefinition, current: Level, language: string, genre?: string, settings: ExplainSettings = {}): string => {
  const { optionLayers = [], levelFrom } = settings;
  const ui = uiLanguageOf(language);
  const text = TEXT[ui];
  const experimental = rule.status === "experimental" ? [`  ${text.experimental}`] : [];
  return [
    "",
    `  ${readableText(rule, rule.name, language)}   (${rule.id})`,
    "",
    `  ${readableText(rule, rule.why, language)}`,
    "",
    `  ${text.howToFix}: ${readableText(rule, rule.how_to_fix, language)}`,
    ...exampleLines(rule, language, text),
    "",
    `  ${rule.level_sets === "severity" ? text.severities : text.values}`,
    ...definedLevels(rule).map((level) => levelLine(rule, level, current, genre, language)),
    ...genreNote(rule, genre, text),
    ...optionLines(rule, optionLayers, language),
    "",
    `  ${text.now(current)}${levelFrom === undefined ? "" : text.from(levelFrom)}`,
    ...experimental,
    "",
    `  ${text.change(rule.id)}`,
    "",
  ].join("\n");
};
