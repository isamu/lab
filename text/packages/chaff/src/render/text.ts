import type { Finding, Localized, RuleDefinition } from "../plugin.ts";

export const localized = (field: Localized, language: string): string => field[language] ?? field["en"] ?? Object.values(field)[0] ?? "";

const fill = (template: string, values: Readonly<Record<string, string | number>>): string =>
  template.replace(/\{(\w+)\}/gu, (whole, key: string) => {
    const value = values[key];
    return value === undefined ? whole : String(value);
  });

export const messageOf = (rule: RuleDefinition, finding: Finding, language: string): string => fill(localized(rule.message, language), finding.values);

export const MARK: Readonly<Record<string, string>> = { error: "✖", warning: "⚠", info: "·" };
