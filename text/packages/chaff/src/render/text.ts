import type { Finding, Localized, RuleDefinition } from "../plugin.ts";
import { formFor } from "./plural.ts";

export const localized = (field: Localized, language: string): string => field[language] ?? field["en"] ?? Object.values(field)[0] ?? "";

/** `{count}` is the value; `{count|word|words}` is the form that agrees with it (English only; Japanese has no plural). */
const PLACEHOLDER = /\{(\w+)(?:\|([^|{}]*)\|([^|{}]*))?\}/gu;

const fill = (template: string, values: Readonly<Record<string, string | number>>): string =>
  template.replace(PLACEHOLDER, (whole, key: string, singular: string | undefined, plural: string | undefined) => {
    const value = values[key];
    if (value === undefined) return whole;
    return singular === undefined || plural === undefined ? String(value) : formFor(value, singular, plural);
  });

/** A template as the rule reference shows it: each agreeing form as its plural ("{count} such words"). */
export const templateForReading = (template: string): string =>
  template.replace(PLACEHOLDER, (whole, _key: string, singular: string | undefined, plural: string | undefined) =>
    singular === undefined || plural === undefined ? whole : plural,
  );

export const messageOf = (rule: RuleDefinition, finding: Finding, language: string): string => fill(localized(rule.message, language), finding.values);

export const MARK: Readonly<Record<string, string>> = { error: "✖", warning: "⚠", info: "·" };
