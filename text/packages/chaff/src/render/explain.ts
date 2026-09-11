import { definedLevels, resolve } from "../levels.ts";
import { localized } from "./text.ts";
import type { Level, RuleDefinition } from "../plugin.ts";

const levelLine = (rule: RuleDefinition, level: Level, current: Level): string => {
  const mark = level === current ? "\u2192" : " ";
  const name = level.padEnd(9);
  return level === "off" ? `  ${mark} ${name}見ない` : `  ${mark} ${name}${resolve(rule, level).limit}`;
};

/** rule の意図と根拠を読む。指摘に納得できないときの入口。 */
export const renderExplain = (rule: RuleDefinition, current: Level, language: string, unit: string): string => {
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
    ...definedLevels(rule).map((level) => levelLine(rule, level, current)),
    "",
    `  いまは ${current} です。`,
    ...experimental,
    "",
    `  変える:  npx chaff relax ${rule.id} --why "理由"`,
    "",
  ].join("\n");
};
