import { definedLevels, resolve, severityAt } from "../levels.ts";
import { readableText } from "./text.ts";
import { SEVERITY_NAME } from "./severity-name.ts";
import { uiLanguageOf, type Texts, type UiLanguage } from "../ui.ts";
import type { Level, RuleDefinition } from "../plugin.ts";
import { optionLines } from "./options.ts";
import type { OptionLayer } from "../rule-options.ts";

const TEXT: Texts<{
  readonly off: string;
  readonly defaultGenre: string;
  readonly genreNote: (genre: string, others: string) => string;
  readonly experimental: string;
  readonly howToFix: string;
  readonly values: (unit: string) => string;
  readonly severities: string;
  readonly now: (level: string) => string;
  readonly change: (id: string) => string;
}> = {
  ja: {
    off: "見ない",
    defaultGenre: "既定",
    genreNote: (genre, others) => `この数字は ${genre} のものです。ほかに ${others} で別の数字を持っています。`,
    experimental: "このルールはまだ試験中で、既定では動きません（--experimental で動きます）。",
    howToFix: "直しかた",
    values: (unit) => `設定できる値（単位: ${unit}）:`,
    severities: "設定できる値（数える上限は無く、指摘の重さが変わります）:",
    now: (level) => `いまは ${level} です。`,
    change: (id) => `変える:  npx chaff relax ${id} --why "理由"`,
  },
  en: {
    off: "not checked",
    defaultGenre: "the default genre",
    genreNote: (genre, others) => `These numbers are for ${genre}. ${others} have numbers of their own.`,
    experimental: "This rule is still experimental and does not run by default (--experimental runs it).",
    howToFix: "How to fix",
    values: (unit) => `Levels (unit: ${unit}):`,
    severities: "Levels (there is no limit to count to; a level sets how a finding is marked):",
    now: (level) => `Now: ${level}.`,
    change: (id) => `Change it:  npx chaff relax ${id} --why "reason"`,
  },
};

/** What a level holds: the limit a detector counts to, or the severity a rule with nothing to count gives. */
const valueAt = (rule: RuleDefinition, level: Exclude<Level, "off">, genre: string | undefined, ui: UiLanguage): string =>
  rule.level_sets === "severity" ? SEVERITY_NAME[ui][severityAt(rule, level, genre)] : String(resolve(rule, level, genre).limit);

const levelLine = (rule: RuleDefinition, level: Level, current: Level, genre: string | undefined, ui: UiLanguage): string => {
  const mark = level === current ? "→" : " ";
  const name = level.padEnd(9);
  return level === "off" ? `  ${mark} ${name}${TEXT[ui].off}` : `  ${mark} ${name}${valueAt(rule, level, genre, ui)}`;
};

/** ジャンルで数字が変わる rule は、それを言わないと「設定したのに効かない」に見える。 */
const genreNote = (rule: RuleDefinition, genre: string | undefined, text: (typeof TEXT)["ja"]): string[] => {
  const others = Object.keys(rule.by_genre).filter((key) => key !== genre);
  if (others.length === 0) return [];
  return ["", `  ${text.genreNote(genre ?? text.defaultGenre, others.join(" / "))}`];
};

/** rule の意図と根拠を読む。指摘に納得できないときの入口。 */
export const renderExplain = (
  rule: RuleDefinition,
  current: Level,
  language: string,
  unit: string,
  genre?: string,
  optionLayers: readonly OptionLayer[] = [],
): string => {
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
    "",
    `  ${rule.level_sets === "severity" ? text.severities : text.values(unit)}`,
    ...definedLevels(rule).map((level) => levelLine(rule, level, current, genre, ui)),
    ...genreNote(rule, genre, text),
    ...optionLines(rule, optionLayers, language),
    "",
    `  ${text.now(current)}`,
    ...experimental,
    "",
    `  ${text.change(rule.id)}`,
    "",
  ].join("\n");
};
