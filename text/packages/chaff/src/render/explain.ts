import { definedLevels, resolve } from "../levels.ts";
import { localized } from "./text.ts";
import { uiLanguageOf, type Texts } from "../ui.ts";
import type { Level, RuleDefinition } from "../plugin.ts";

const TEXT: Texts<{
  readonly off: string;
  readonly defaultGenre: string;
  readonly genreNote: (genre: string, others: string) => string;
  readonly experimental: string;
  readonly howToFix: string;
  readonly values: (unit: string) => string;
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
    now: (level) => `Now: ${level}.`,
    change: (id) => `Change it:  npx chaff relax ${id} --why "reason"`,
  },
};

const levelLine = (rule: RuleDefinition, level: Level, current: Level, genre: string | undefined, off: string): string => {
  const mark = level === current ? "→" : " ";
  const name = level.padEnd(9);
  return level === "off" ? `  ${mark} ${name}${off}` : `  ${mark} ${name}${resolve(rule, level, genre).limit}`;
};

/** ジャンルで数字が変わる rule は、それを言わないと「設定したのに効かない」に見える。 */
const genreNote = (rule: RuleDefinition, genre: string | undefined, text: (typeof TEXT)["ja"]): string[] => {
  const others = Object.keys(rule.by_genre).filter((key) => key !== genre);
  if (others.length === 0) return [];
  return ["", `  ${text.genreNote(genre ?? text.defaultGenre, others.join(" / "))}`];
};

/** rule の意図と根拠を読む。指摘に納得できないときの入口。 */
export const renderExplain = (rule: RuleDefinition, current: Level, language: string, unit: string, genre?: string): string => {
  const text = TEXT[uiLanguageOf(language)];
  const experimental = rule.status === "experimental" ? [`  ${text.experimental}`] : [];
  return [
    "",
    `  ${localized(rule.name, language)}   (${rule.id})`,
    "",
    `  ${localized(rule.why, language)}`,
    "",
    `  ${text.howToFix}: ${localized(rule.how_to_fix, language)}`,
    "",
    `  ${text.values(unit)}`,
    ...definedLevels(rule).map((level) => levelLine(rule, level, current, genre, text.off)),
    ...genreNote(rule, genre, text),
    "",
    `  ${text.now(current)}`,
    ...experimental,
    "",
    `  ${text.change(rule.id)}`,
    "",
  ].join("\n");
};
