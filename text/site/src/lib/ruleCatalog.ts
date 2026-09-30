// The guide's reference: every rule chaff ships, grouped the way a reader thinks, each with an example and what chaff
// printed for it. The messages come from running the command line on the examples before the build (yarn examples).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  rulesByGroup,
  type ExampleFinding,
  type ExampleOutcome,
  type RuleExample,
  type RuleGroup,
} from "../../../packages/chaff/src/rule-guide.ts";
import { otherLang, type Lang } from "./i18n";
import { rules, type Rule } from "./rules";

// astro build runs in text/site; `yarn examples` writes this file first.
const OUTCOMES_FILE = resolve(process.cwd(), "src", "generated", "rule-examples.json");

/** How a rule gets to run: on by default, experimental, only with a list in chaff.yaml, or through chaff test. */
export type RunsWhen = "default" | "experimental" | "team" | "test";

export type CatalogEntry = {
  readonly rule: Rule;
  readonly runsWhen: RunsWhen;
  /** The example in the page's language, or in the one language the rule runs in. */
  readonly exampleLang: Lang;
  readonly example: RuleExample;
  /** What chaff said about the rule on the example; empty for chaff test, which the build does not run. */
  readonly output: readonly ExampleFinding[];
};

export type CatalogGroup = { readonly group: RuleGroup; readonly entries: readonly CatalogEntry[] };

const isFinding = (value: unknown): value is ExampleFinding =>
  typeof value === "object" &&
  value !== null &&
  "line" in value &&
  "column" in value &&
  "message" in value &&
  typeof value.message === "string";

const isOutcome = (value: unknown): value is ExampleOutcome =>
  typeof value === "object" &&
  value !== null &&
  "rule" in value &&
  "language" in value &&
  "before" in value &&
  Array.isArray(value.before) &&
  value.before.every(isFinding);

const readOutcomes = (): readonly ExampleOutcome[] => {
  const parsed: unknown = JSON.parse(readFileSync(OUTCOMES_FILE, "utf8"));
  if (!Array.isArray(parsed) || !parsed.every(isOutcome)) throw new Error(`${OUTCOMES_FILE}: not the output of scripts/rule-examples.ts`);
  return parsed;
};

const outcomes = readOutcomes();

const runsWhenOf = (rule: Rule): RunsWhen => {
  if (rule.layer === "L4") return "test";
  if (rule.group === "team") return "team";
  return rule.status === "stable" ? "default" : "experimental";
};

const exampleLangOf = (rule: Rule, lang: Lang): Lang => (rule.examples[lang] !== undefined ? lang : otherLang(lang));

const outputOf = (rule: Rule, lang: Lang): readonly ExampleFinding[] => {
  if (rule.layer === "L4") return [];
  const outcome = outcomes.find((candidate) => candidate.rule === rule.id && candidate.language === lang);
  // An example that no longer makes chaff say anything would show the reader a promise the tool does not keep.
  if (outcome === undefined || outcome.before.length === 0)
    throw new Error(`${rule.id}: chaff says nothing on its ${lang} example; run yarn examples`);
  return outcome.before;
};

/** One rule's row: its example in the page's language (or the one it checks) and what chaff printed. */
export const entryOf = (rule: Rule, lang: Lang): CatalogEntry => {
  const exampleLang = exampleLangOf(rule, lang);
  const example = rule.examples[exampleLang];
  if (example === undefined) throw new Error(`${rule.id}: no example in its rule file`);
  return { rule, runsWhen: runsWhenOf(rule), exampleLang, example, output: outputOf(rule, exampleLang) };
};

/** Every rule, once, in its group. A rule missing from the groups stops the build rather than drop off the page. */
export const catalogOf = (lang: Lang): readonly CatalogGroup[] => {
  const groups = rulesByGroup(rules, (rule) => rule.group).map(({ group, rules: members }) => ({
    group,
    entries: members.map((rule) => entryOf(rule, lang)),
  }));
  const listed = new Set(groups.flatMap((group) => group.entries.map((entry) => entry.rule.id)));
  const missing = rules.filter((rule) => !listed.has(rule.id)).map((rule) => rule.id);
  if (missing.length > 0) throw new Error(`the reference leaves out ${missing.join(", ")}: give each a group in its rule file`);
  return groups;
};
