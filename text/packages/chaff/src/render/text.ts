import type { Finding, Localized, RuleDefinition } from "../plugin.ts";
import { formFor } from "./plural.ts";

export const localized = (field: Localized, language: string): string => field[language] ?? field["en"] ?? Object.values(field)[0] ?? "";

/** `{count}` is the value; `{count|word|words}` is the form that agrees with it (English only; Japanese has no plural). */
const PLACEHOLDER = /\{(\w+)(?:\|([^|{}]*)\|([^|{}]*))?\}/gu;

export const fill = (template: string, values: Readonly<Record<string, string | number>>): string =>
  template.replace(PLACEHOLDER, (whole, key: string, singular: string | undefined, plural: string | undefined) => {
    const value = values[key];
    if (value === undefined) return whole;
    return singular === undefined || plural === undefined ? String(value) : formFor(value, singular, plural);
  });

/** A template as the rule reference shows it: each agreeing form as its plural ("{count} such words"), each value as its reading when given. */
export const templateForReading = (template: string, readings: Readonly<Record<string, string>> = {}): string =>
  template.replace(PLACEHOLDER, (whole, key: string, singular: string | undefined, plural: string | undefined) =>
    singular === undefined || plural === undefined ? (readings[key] ?? whole) : plural,
  );

/** A rule's text for one finding, with the finding's values in it. */
export const filledText = (field: Localized, finding: Finding, language: string): string => fill(localized(field, language), finding.values);

/** A rule's text where no finding fills it (explain, rules --json, the rule reference): each value as the rule's words for it. */
export const readableText = (rule: Pick<RuleDefinition, "placeholders">, field: Localized, language: string): string => {
  // The same fallback as the text itself: an English-only rule read in Japanese still gets its English words.
  const readings = Object.fromEntries(
    Object.entries(rule.placeholders ?? {}).flatMap(([key, reading]) => {
      const words = localized(reading, language);
      return words === "" ? [] : [[key, words]];
    }),
  );
  return templateForReading(localized(field, language), readings);
};

const templateOf = (rule: RuleDefinition, finding: Finding): Localized =>
  (finding.variant === undefined ? undefined : rule.messages[finding.variant]) ?? rule.message;

export const messageOf = (rule: RuleDefinition, finding: Finding, language: string): string => filledText(templateOf(rule, finding), finding, language);

export const MARK: Readonly<Record<string, string>> = { error: "✖", warning: "⚠", info: "·" };
