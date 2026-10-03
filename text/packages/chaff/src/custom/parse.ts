import type { CustomSpec, Localized, RuleDefinition, TokenCondition } from "../plugin.ts";
import { regexRefusal, type RegexRefusal } from "./regex-safety.ts";
import { posTags } from "./token-pattern.ts";
import { modulePathOf, type ModulePathRefusal } from "./module-path.ts";
import type { FieldProblem } from "../rule-fields.ts";
import { failed, ok, type Checked } from "./checked.ts";
import { describedOf, exampleSides, levelsOf, type Described, type RuleLevels } from "./dsl-fields.ts";

// custom_rules in chaff.yaml: a team's own deterministic rules, written without code. Each becomes a RuleDefinition like the
// built-in ones, so findings, explain, rules --json, stet, the baseline and SARIF treat it the same. Pure: the YAML comes in parsed.

export const CUSTOM_TYPES = ["words", "pattern", "tokens", "module"] as const;

export type CustomProblem =
  | { readonly kind: "not-a-list" }
  | { readonly kind: "not-a-map"; readonly at: string }
  | { readonly kind: "bad-id"; readonly at: string }
  | { readonly kind: "duplicate-id"; readonly at: string }
  | { readonly kind: "built-in-id"; readonly at: string }
  | { readonly kind: "unknown-type"; readonly at: string; readonly written: string }
  | { readonly kind: "bad-module"; readonly at: string; readonly written: string; readonly refusal: ModulePathRefusal }
  | { readonly kind: "bad-requires"; readonly at: string; readonly written: string }
  | { readonly kind: "bad-word-list"; readonly at: string; readonly written: string }
  | { readonly kind: "missing"; readonly at: string; readonly field: string }
  | { readonly kind: "unpaired-example"; readonly at: string }
  | { readonly kind: "bad-level"; readonly at: string; readonly written: string }
  | { readonly kind: "bad-languages"; readonly at: string }
  | { readonly kind: "no-words"; readonly at: string }
  | { readonly kind: "bad-pattern"; readonly at: string; readonly refusal: RegexRefusal }
  | { readonly kind: "no-tokens"; readonly at: string }
  | { readonly kind: "bad-token"; readonly at: string; readonly index: number }
  | { readonly kind: "unknown-pos"; readonly at: string; readonly written: string }
  | { readonly kind: "level-and-levels"; readonly at: string }
  | { readonly kind: "bad-levels"; readonly at: string; readonly written: string }
  | (FieldProblem & { readonly at: string });

export type CustomRules = { readonly rules: readonly RuleDefinition[]; readonly problems: readonly CustomProblem[] };

/**
 * What parsing needs to know: the built-in rule ids (a team's rule may not take one), the genres a rule applies to when
 * it does not say (useFor), every genre a use_for may name, and the folder a module's path is relative to (where chaff.yaml is).
 */
export type CustomContext = {
  readonly builtIn: ReadonlySet<string>;
  readonly useFor: readonly string[];
  readonly genres: readonly string[];
  readonly baseDir: string;
};

const RULE_ID = /^[a-z][a-z0-9-]*$/u;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

/** Texts by language ({ ja, en } or any language's id). undefined when there is none. */
const byLanguageOf = (value: unknown): Localized | undefined => {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter((entry): entry is [string, string] => nonEmpty(entry[1]));
  return entries.length === 0 ? undefined : Object.fromEntries(entries.map(([language, text]) => [language, text.trim()]));
};

/** A text by language, or one string for ja and en (and, through the "en" fallback, for any other language). */
const localizedOf = (value: unknown): Localized | undefined => (nonEmpty(value) ? { ja: value.trim(), en: value.trim() } : byLanguageOf(value));

/** The key an example side written as one string is kept under: it reads the same in every language. */
const EVERY_LANGUAGE = "*";

const exampleSideOf = (value: unknown): Localized | undefined => (nonEmpty(value) ? { [EVERY_LANGUAGE]: value.trim() } : byLanguageOf(value));

type Pair = { readonly avoid: string; readonly use: string };

/** words as a map (avoid: use) or a list (words to point at, with nothing to use instead). */
const pairsOf = (raw: unknown): Pair[] => {
  if (Array.isArray(raw)) return raw.filter(nonEmpty).map((avoid) => ({ avoid: avoid.trim(), use: "" }));
  if (!isRecord(raw)) return [];
  return Object.entries(raw).flatMap(([avoid, use]) => (avoid.trim() === "" ? [] : [{ avoid: avoid.trim(), use: nonEmpty(use) ? use.trim() : "" }]));
};

const printed = (value: unknown): string => JSON.stringify(value) ?? "undefined";

const wordsOf = (raw: unknown, at: string): Checked<CustomSpec> => {
  const usable = pairsOf(raw).filter((pair) => pair.avoid !== pair.use);
  return usable.length === 0 ? failed({ kind: "no-words", at }) : ok({ type: "words", words: usable });
};

const patternOf = (raw: Record<string, unknown>, at: string): Checked<CustomSpec> => {
  const pattern = raw["pattern"];
  if (!nonEmpty(pattern)) return failed({ kind: "missing", at, field: "pattern" });
  const flags = raw["ignore_case"] === true ? "iu" : "u";
  const refusal = regexRefusal(pattern, flags);
  return refusal === undefined ? ok({ type: "pattern", pattern, flags }) : failed({ kind: "bad-pattern", at, refusal });
};

const posOf = (raw: unknown, at: string): Checked<readonly string[]> => {
  if (raw === undefined) return ok([]);
  const written = (Array.isArray(raw) ? raw : [raw]).map((entry: unknown) => (typeof entry === "string" ? entry : printed(entry)));
  const unknown = written.find((name) => posTags(name) === undefined);
  if (unknown !== undefined) return failed({ kind: "unknown-pos", at, written: unknown });
  return ok([...new Set(written.flatMap((name) => posTags(name) ?? []))]);
};

const conditionOf = (raw: unknown, index: number, at: string): Checked<TokenCondition> => {
  if (!isRecord(raw)) return failed({ kind: "bad-token", at, index });
  const pos = posOf(raw["pos"], at);
  if (pos.value === undefined) return failed(...pos.problems);
  // lemma is the linguists' word for the base form; either may be written.
  const written = raw["base"] ?? raw["lemma"];
  const base = nonEmpty(written) ? written.trim() : undefined;
  const surface = nonEmpty(raw["surface"]) ? raw["surface"].trim() : undefined;
  if (pos.value.length === 0 && base === undefined && surface === undefined) return failed({ kind: "bad-token", at, index });
  return ok({ ...(pos.value.length === 0 ? {} : { pos: pos.value }), ...(base === undefined ? {} : { base }), ...(surface === undefined ? {} : { surface }) });
};

const tokensOf = (raw: unknown, at: string): Checked<CustomSpec> => {
  if (!Array.isArray(raw) || raw.length === 0) return failed({ kind: "no-tokens", at });
  const checked = raw.map((entry: unknown, index) => conditionOf(entry, index + 1, at));
  const problems = checked.flatMap((entry) => entry.problems);
  const tokens = checked.flatMap((entry) => (entry.value === undefined ? [] : [entry.value]));
  return problems.length > 0 ? failed(...problems) : ok({ type: "tokens", tokens });
};

const moduleOf = (raw: Record<string, unknown>, at: string, baseDir: string): Checked<CustomSpec> => {
  const written = raw["module"];
  if (!nonEmpty(written)) return failed({ kind: "missing", at, field: "module" });
  const path = modulePathOf(written.trim(), baseDir);
  if ("refusal" in path) return failed({ kind: "bad-module", at, written, refusal: path.refusal });
  return ok({ type: "module", module: written.trim(), file: path.file });
};

const specOf = (raw: Record<string, unknown>, type: string, at: string, baseDir: string): Checked<CustomSpec> => {
  // A words rule may take its words from a word list instead, one per language (a rule pack's lexicons/<language>/).
  if (type === "words") return takesWordList(raw, type) ? ok({ type: "words", words: [] }) : wordsOf(raw["words"], at);
  if (type === "pattern") return patternOf(raw, at);
  if (type === "module") return moduleOf(raw, at, baseDir);
  return tokensOf(raw["tokens"], at);
};

const typeOf = (raw: Record<string, unknown>, at: string): Checked<string> => {
  const type = raw["type"];
  if (!nonEmpty(type)) return failed({ kind: "missing", at, field: "type" });
  return CUSTOM_TYPES.some((known) => known === type) ? ok(type) : failed({ kind: "unknown-type", at, written: type });
};

type Texts = { readonly name: Localized; readonly why: Localized; readonly how_to_fix: Localized; readonly before: Localized; readonly after: Localized };

const textsOf = (raw: Record<string, unknown>, at: string): Checked<Texts> => {
  const example = exampleSides(raw["example"]);
  const found = {
    name: localizedOf(raw["name"]),
    why: localizedOf(raw["why"]),
    how_to_fix: localizedOf(raw["how_to_fix"]),
    before: exampleSideOf(example.before),
    after: exampleSideOf(example.after),
  };
  const missing = Object.entries(found).flatMap(([field, text]) =>
    text === undefined ? [{ kind: "missing" as const, at, field: field === "before" || field === "after" ? `example.${field}` : field }] : [],
  );
  const { name, why, how_to_fix: howToFix, before, after } = found;
  if (name === undefined || why === undefined || howToFix === undefined || before === undefined || after === undefined) return failed(...missing);
  return ok({ name, why, how_to_fix: howToFix, before, after });
};

/** What a module's detector may ask the adapter for. Only parts of speech: without them, sentences have no tokens. */
const REQUIRABLE: readonly string[] = ["pos"];

const requiresOf = (raw: unknown, type: string, at: string): Checked<readonly string[]> => {
  if (type === "tokens") return ok(["pos"]);
  if (raw === undefined || type !== "module") return ok([]);
  const written = (Array.isArray(raw) ? raw : [raw]).map((entry: unknown) => (typeof entry === "string" ? entry : printed(entry)));
  const unknown = written.find((need) => !REQUIRABLE.includes(need));
  return unknown === undefined ? ok([...new Set(written)]) : failed({ kind: "bad-requires", at, written: unknown });
};

/** A module reads a word list; so does a words rule that writes word_list in place of words. The others carry their words. */
const takesWordList = (raw: Record<string, unknown>, type: string): boolean =>
  raw["word_list"] !== undefined && (type === "module" || (type === "words" && raw["words"] === undefined));

/** The word list by name; the detector gets it, in the document's language, as options.lexicon. */
const wordListOf = (raw: unknown, takesList: boolean, at: string): Checked<string | undefined> => {
  if (raw === undefined || !takesList) return ok(undefined);
  return nonEmpty(raw) ? ok(raw.trim()) : failed({ kind: "bad-word-list", at, written: printed(raw) });
};

/** What a rule's detector needs besides the document: tokens from the adapter, and a word list. */
type Needs = { readonly requires: readonly string[]; readonly wordList: string | undefined };

const needsOf = (raw: Record<string, unknown>, type: string, at: string): Checked<Needs> => {
  const requires = requiresOf(raw["requires"], type, at);
  const wordList = wordListOf(raw["word_list"], takesWordList(raw, type), at);
  if (requires.value === undefined || wordList.problems.length > 0) return failed(...requires.problems, ...wordList.problems);
  return ok({ requires: requires.value, wordList: wordList.value });
};

const languagesOf = (raw: unknown, at: string): Checked<readonly string[] | undefined> => {
  if (raw === undefined) return ok(undefined);
  const list = Array.isArray(raw) ? raw : [raw];
  return list.length > 0 && list.every(nonEmpty) ? ok(list.map((entry: string) => entry.trim())) : failed({ kind: "bad-languages", at });
};

/** The message when a rule does not write one: the replacement for a word list, else the rule's name and what was found. */
const defaultMessage = (spec: CustomSpec, name: Localized): Localized => {
  if (spec.type === "words" && spec.words.every((pair) => pair.use !== ""))
    return { ja: "「{matched}」は「{preferred}」と書きます", en: 'Write "{preferred}", not "{matched}"' };
  return Object.fromEntries(Object.entries(name).map(([language, text]) => [language, language === "ja" ? `${text}:「{matched}」` : `${text}: "{matched}"`]));
};

const PLACEHOLDERS: Readonly<Record<string, Localized>> = {
  matched: { ja: "見つけた語句", en: "the text found" },
  preferred: { ja: "使う書き方", en: "the spelling to use" },
};

/** A module's detector is not in chaff's table: it is loaded from the module and found by the rule's id. */
const HOW_TO_FIND: Readonly<Record<CustomSpec["type"], string>> = {
  words: "custom-words",
  pattern: "custom-pattern",
  tokens: "custom-tokens",
  module: "module",
};

type Example = { readonly before: string; readonly after: string };

type Parts = {
  readonly spec: CustomSpec;
  readonly needs: Needs;
  readonly levels: RuleLevels;
  readonly texts: Texts;
  readonly languages: readonly string[] | undefined;
  readonly examples: Readonly<Record<string, Example>>;
  readonly described: Described;
};

const READER_LANGUAGES: readonly string[] = ["ja", "en"];

/** The example in each language the rule checks, where both before and after are written in it. A string counts for both. */
const examplesOf = (texts: Texts, languages: readonly string[] | undefined): Record<string, Example> =>
  Object.fromEntries(
    (languages ?? READER_LANGUAGES).flatMap((language) => {
      const [before, after] = [texts.before[language] ?? texts.before[EVERY_LANGUAGE], texts.after[language] ?? texts.after[EVERY_LANGUAGE]];
      return before === undefined || after === undefined ? [] : [[language, { before, after }]];
    }),
  );

const definitionOf = (id: string, raw: Record<string, unknown>, parts: Parts, useFor: readonly string[]): RuleDefinition => ({
  id,
  layer: parts.needs.requires.includes("pos") ? "L3" : "L2",
  status: "stable",
  name: parts.texts.name,
  why: parts.texts.why,
  how_to_fix: parts.texts.how_to_fix,
  message: localizedOf(raw["message"]) ?? defaultMessage(parts.spec, parts.texts.name),
  messages: {},
  placeholders: PLACEHOLDERS,
  levels: parts.levels.table,
  level_sets: "severity",
  by_genre: {},
  how_to_find: HOW_TO_FIND[parts.spec.type],
  word_list: parts.needs.wordList,
  extra_word_lists: [],
  what_to_check: undefined,
  where: undefined,
  full_sentence: undefined,
  requires: parts.needs.requires,
  uses: [],
  from: [],
  languages: parts.languages,
  use_for: parts.described.useFor ?? useFor,
  severity: parts.levels.severity,
  custom: parts.spec,
  // The reference and explain read a rule's plain-language fields from guide; a team's rule is listed with the team's words.
  guide: {
    group: parts.described.group,
    summary: parts.described.summary ?? parts.texts.name,
    examples: parts.examples,
    notFlagged: {},
    levelMeaning: {},
    sources: [],
    rewrite: parts.described.rewrite,
    rewriteDepth: parts.described.rewriteDepth,
  },
});

const idOf = (raw: Record<string, unknown>, index: number, seen: ReadonlySet<string>, builtIn: ReadonlySet<string>): Checked<string> => {
  const id = raw["id"];
  const at = typeof id === "string" && id !== "" ? id : `#${String(index + 1)}`;
  if (typeof id !== "string" || !RULE_ID.test(id)) return failed({ kind: "bad-id", at });
  if (builtIn.has(id)) return failed({ kind: "built-in-id", at });
  return seen.has(id) ? failed({ kind: "duplicate-id", at }) : ok(id);
};

/** Each field of one rule, checked. */
type Checks = {
  readonly id: Checked<string>;
  readonly spec: Checked<CustomSpec>;
  readonly needs: Checked<Needs>;
  readonly levels: Checked<RuleLevels>;
  readonly texts: Checked<Texts>;
  readonly languages: Checked<readonly string[] | undefined>;
  readonly described: Checked<Described>;
};

/** The rule's parts once every check passed; undefined when one has no value. */
const partsOf = (checks: Checks, examples: Readonly<Record<string, Example>>): { readonly id: string; readonly parts: Parts } | undefined => {
  const { id, spec, needs, levels, texts, described } = checks;
  if (id.value === undefined || spec.value === undefined || needs.value === undefined) return undefined;
  if (levels.value === undefined || texts.value === undefined || described.value === undefined) return undefined;
  const parts = { spec: spec.value, needs: needs.value, levels: levels.value, texts: texts.value, languages: checks.languages.value, examples };
  return { id: id.value, parts: { ...parts, described: described.value } };
};

const ruleOf = (raw: unknown, index: number, seen: ReadonlySet<string>, context: CustomContext): Checked<RuleDefinition> => {
  if (!isRecord(raw)) return failed({ kind: "not-a-map", at: `#${String(index + 1)}` });
  const id = idOf(raw, index, seen, context.builtIn);
  const at = id.value ?? (nonEmpty(raw["id"]) ? raw["id"] : `#${String(index + 1)}`);
  const type = typeOf(raw, at);
  const checks: Checks = {
    id,
    spec: type.value === undefined ? failed<CustomSpec>() : specOf(raw, type.value, at, context.baseDir),
    needs: needsOf(raw, type.value ?? "", at),
    levels: levelsOf(raw, at),
    texts: textsOf(raw, at),
    languages: languagesOf(raw["languages"], at),
    described: describedOf(raw, at, context.genres),
  };
  const { texts, languages } = checks;
  const examples = texts.value === undefined ? {} : examplesOf(texts.value, languages.value);
  const unpaired: CustomProblem[] = texts.value !== undefined && Object.keys(examples).length === 0 ? [{ kind: "unpaired-example", at }] : [];
  const ordered: Checked<unknown>[] = [id, type, checks.spec, checks.needs, checks.levels, texts, languages, checks.described];
  const problems = [...ordered.flatMap((checked) => checked.problems), ...unpaired];
  const ready = problems.length > 0 ? undefined : partsOf(checks, examples);
  return ready === undefined ? failed(...problems) : ok(definitionOf(ready.id, raw, ready.parts, context.useFor));
};

/** custom_rules as written. Every problem is reported; a rule with a problem is left out, and the run is stopped by the caller. */
export const parseCustomRules = (raw: unknown, context: CustomContext): CustomRules => {
  if (raw === undefined || raw === null) return { rules: [], problems: [] };
  if (!Array.isArray(raw)) return { rules: [], problems: [{ kind: "not-a-list" }] };
  return raw.reduce<{ rules: RuleDefinition[]; problems: CustomProblem[] }>(
    (acc, entry: unknown, index) => {
      const checked = ruleOf(entry, index, new Set(acc.rules.map((rule) => rule.id)), context);
      return { rules: checked.value === undefined ? acc.rules : [...acc.rules, checked.value], problems: [...acc.problems, ...checked.problems] };
    },
    { rules: [], problems: [] },
  );
};
