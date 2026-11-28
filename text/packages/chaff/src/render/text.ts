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

/** An English reading that opens with a determiner (the word found) describes the value; one that does not (always, N) is a sample of it. */
const DESCRIBING = /^(?:the|a|an|another|one|how)\s/iu;
/** A stand-in for the value itself (〇〇), which reads as the word in quotation marks. */
const STAND_IN = /^〇+$/u;
const QUOTED_PLACEHOLDER = /([「『“"])\{(\w+)\}([」』”"])/gu;
const CLOSER: Readonly<Record<string, string>> = { "「": "」", "『": "』", "“": "”", '"': '"' };

/** A description in quotation marks reads as if it were the word itself (Change it to 「直した書き方」), so its marks go. */
const unquoteDescriptions = (template: string, describing: ReadonlySet<string>): string =>
  template.replace(QUOTED_PLACEHOLDER, (whole, open: string, key: string, close: string) =>
    CLOSER[open] === close && describing.has(key) ? `{${key}}` : whole,
  );

/** A rule's text where no finding fills it (explain, rules --json, the rule reference): each value as the rule's words for it. */
export const readableText = (rule: Pick<RuleDefinition, "placeholders">, field: Localized, language: string): string => {
  // The same fallback as the text itself: an English-only rule read in Japanese still gets its English words.
  const entries = Object.entries(rule.placeholders ?? {}).flatMap(([key, reading]) => {
    const words = localized(reading, language);
    return words === "" ? [] : [{ key, words, describing: DESCRIBING.test(reading["en"] ?? "") && !STAND_IN.test(words) }];
  });
  const readings = Object.fromEntries(entries.map(({ key, words }) => [key, words]));
  const describing = new Set(entries.filter((entry) => entry.describing).map(({ key }) => key));
  return templateForReading(unquoteDescriptions(localized(field, language), describing), readings);
};

const templateOf = (rule: RuleDefinition, finding: Finding): Localized =>
  (finding.variant === undefined ? undefined : rule.messages[finding.variant]) ?? rule.message;

export const messageOf = (rule: RuleDefinition, finding: Finding, language: string): string => filledText(templateOf(rule, finding), finding, language);

export const MARK: Readonly<Record<string, string>> = { error: "✖", warning: "⚠", info: "·" };
