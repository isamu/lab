import { definedLevels, resolve } from "../levels.ts";
import { localized } from "./text.ts";
import type { Level, RuleDefinition } from "../plugin.ts";

const levelLine = (rule: RuleDefinition, level: Level, current: Level, genre: string | undefined): string => {
  const mark = level === current ? "\u2192" : " ";
  const name = level.padEnd(9);
  return level === "off" ? `  ${mark} ${name}見ない` : `  ${mark} ${name}${resolve(rule, level, genre).limit}`;
};

/** ジャンルで数字が変わる rule は、それを言わないと「設定したのに効かない」に見える。 */
const genreNote = (rule: RuleDefinition, genre: string | undefined): string[] => {
  const others = Object.keys(rule.by_genre).filter((key) => key !== genre);
  if (others.length === 0) return [];
  return ["", `  この数字は ${genre ?? "既定"} のものです。ほかに ${others.join(" / ")} で別の数字を持っています。`];
};

/** rule の意図と根拠を読む。指摘に納得できないときの入口。 */
export const renderExplain = (rule: RuleDefinition, current: Level, language: string, unit: string, genre?: string): string => {
  const experimental = rule.status === "experimental" ? ["  このルールはまだ試験中で、既定では動きません（--experimental で動きます）。"] : [];
  return [
    "",
    `  ${localized(rule.name, language)}   (${rule.id})`,
    "",
    `  ${localized(rule.why, language)}`,
    "",
    `  直しかた: ${localized(rule.how_to_fix, language)}`,
    "",
    `  設定できる値（単位: ${unit}）:`,
    ...definedLevels(rule).map((level) => levelLine(rule, level, current, genre)),
    ...genreNote(rule, genre),
    "",
    `  いまは ${current} です。`,
    ...experimental,
    "",
    `  変える:  npx chaff relax ${rule.id} --why "理由"`,
    "",
  ].join("\n");
};
