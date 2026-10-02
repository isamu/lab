import { isAtomKind, type AtomKind } from "../compare/atom.ts";

// The `grade:` section of chaff.yaml (spec §29.4), read and checked. Pure. A section that cannot be read stops the run
// (exit 2): a rubric that silently checks less than was written would pass outputs it was meant to fail.

export type RuleLimit = {
  /** Findings allowed per output. */
  readonly max?: number | undefined;
  /** Findings allowed per 1,000 characters or words. */
  readonly maxRate?: number | undefined;
  /** Penalty points per finding. */
  readonly weight?: number | undefined;
};

export type FactLimits = {
  readonly dropped?: number | undefined;
  readonly added?: number | undefined;
  readonly allowDropped: readonly AtomKind[];
  readonly allowAdded: readonly AtomKind[];
};

export type CitationLimits = { readonly failed?: number | undefined; readonly required: boolean };

export type Rubric = {
  readonly rules: Readonly<Record<string, RuleLimit>>;
  /** Undefined when not written: chaff.yaml's top-level required_sections apply. */
  readonly requiredSections?: readonly string[] | undefined;
  readonly facts?: FactLimits | undefined;
  readonly citations?: CitationLimits | undefined;
  readonly penalty?: number | undefined;
};

/** What a value under `grade:` should have been. */
export type Expected = "map" | "count" | "number" | "boolean" | "words" | "kinds" | "known-key";

/** Where under `grade:` (a dotted path), what it should be, and what was written. */
export type RubricProblem = { readonly path: string; readonly expected: Expected; readonly written: string };

type Read<T> = { readonly value: T; readonly problems: readonly RubricProblem[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const printed = (value: unknown): string => JSON.stringify(value) ?? String(value);

const problem = (path: string, expected: Expected, written: unknown): RubricProblem => ({ path, expected, written: printed(written) });

const ok = <T>(value: T): Read<T> => ({ value, problems: [] });

const isCount = (value: unknown): value is number => Number.isInteger(value) && typeof value === "number" && value >= 0;

const isAmount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

/** An optional number under `path`: a count (a whole number) or an amount (any number from 0). */
const optional = (raw: Record<string, unknown>, key: string, path: string, expected: "count" | "number"): Read<number | undefined> => {
  const value = raw[key];
  if (value === undefined) return ok(undefined);
  const valid = expected === "count" ? isCount : isAmount;
  return valid(value) ? ok(value) : { value: undefined, problems: [problem(`${path}.${key}`, expected, value)] };
};

/** Keys that are not among `known`. A misspelt `max_rte` would otherwise be a limit nobody checks. */
const unknownKeys = (raw: Record<string, unknown>, known: readonly string[], path: string): RubricProblem[] =>
  Object.keys(raw)
    .filter((key) => !known.includes(key))
    .map((key) => problem(`${path}.${key}`, "known-key", raw[key]));

const ruleLimit = (raw: unknown, path: string): Read<RuleLimit> => {
  if (!isRecord(raw)) return { value: {}, problems: [problem(path, "map", raw)] };
  const max = optional(raw, "max", path, "count");
  const maxRate = optional(raw, "max_rate", path, "number");
  const weight = optional(raw, "weight", path, "number");
  return {
    value: { max: max.value, maxRate: maxRate.value, weight: weight.value },
    problems: [...max.problems, ...maxRate.problems, ...weight.problems, ...unknownKeys(raw, ["max", "max_rate", "weight"], path)],
  };
};

const rulesOf = (raw: unknown): Read<Record<string, RuleLimit>> => {
  if (raw === undefined) return ok({});
  if (!isRecord(raw)) return { value: {}, problems: [problem("grade.rules", "map", raw)] };
  const read = Object.entries(raw).map(([id, limit]) => ({ id, read: ruleLimit(limit, `grade.rules.${id}`) }));
  return { value: Object.fromEntries(read.map((entry) => [entry.id, entry.read.value])), problems: read.flatMap((entry) => entry.read.problems) };
};

const wordsOf = (raw: unknown, path: string): Read<string[] | undefined> => {
  if (raw === undefined) return ok(undefined);
  const valid = Array.isArray(raw) && raw.every((entry) => typeof entry === "string" && entry.trim() !== "");
  return valid ? ok(raw.map((entry: string) => entry.trim())) : { value: undefined, problems: [problem(path, "words", raw)] };
};

const kindsOf = (raw: unknown, path: string): Read<AtomKind[]> => {
  if (raw === undefined) return ok([]);
  const entries: readonly unknown[] = Array.isArray(raw) ? raw : [raw];
  const kinds = entries.filter((entry): entry is AtomKind => typeof entry === "string" && isAtomKind(entry));
  return kinds.length === entries.length ? ok(kinds) : { value: kinds, problems: [problem(path, "kinds", raw)] };
};

const factsOf = (raw: unknown): Read<FactLimits | undefined> => {
  if (raw === undefined) return ok(undefined);
  if (!isRecord(raw)) return { value: undefined, problems: [problem("grade.facts", "map", raw)] };
  const dropped = optional(raw, "dropped", "grade.facts", "count");
  const added = optional(raw, "added", "grade.facts", "count");
  const allowDropped = kindsOf(raw["allow_dropped"], "grade.facts.allow_dropped");
  const allowAdded = kindsOf(raw["allow_added"], "grade.facts.allow_added");
  return {
    value: { dropped: dropped.value, added: added.value, allowDropped: allowDropped.value, allowAdded: allowAdded.value },
    problems: [
      ...dropped.problems,
      ...added.problems,
      ...allowDropped.problems,
      ...allowAdded.problems,
      ...unknownKeys(raw, ["dropped", "added", "allow_dropped", "allow_added"], "grade.facts"),
    ],
  };
};

const citationsOf = (raw: unknown): Read<CitationLimits | undefined> => {
  if (raw === undefined) return ok(undefined);
  if (!isRecord(raw)) return { value: undefined, problems: [problem("grade.citations", "map", raw)] };
  const failed = optional(raw, "failed", "grade.citations", "count");
  const required = raw["required"];
  const requiredProblems = required === undefined || typeof required === "boolean" ? [] : [problem("grade.citations.required", "boolean", required)];
  return {
    value: { failed: failed.value, required: required === true },
    problems: [...failed.problems, ...requiredProblems, ...unknownKeys(raw, ["failed", "required"], "grade.citations")],
  };
};

const RUBRIC_KEYS: readonly string[] = ["rules", "required_sections", "facts", "citations", "penalty"];

/** The rubric, or every problem in it. No `grade:` at all is no rubric: the default pass or fail applies (spec §29.3). */
export const parseRubric = (raw: unknown): { readonly rubric: Rubric | undefined } | { readonly problems: readonly RubricProblem[] } => {
  if (raw === undefined || raw === null) return { rubric: undefined };
  if (!isRecord(raw)) return { problems: [problem("grade", "map", raw)] };
  const rules = rulesOf(raw["rules"]);
  const sections = wordsOf(raw["required_sections"], "grade.required_sections");
  const facts = factsOf(raw["facts"]);
  const citations = citationsOf(raw["citations"]);
  const penalty = optional(raw, "penalty", "grade", "number");
  const problems = [
    ...rules.problems,
    ...sections.problems,
    ...facts.problems,
    ...citations.problems,
    ...penalty.problems,
    ...unknownKeys(raw, RUBRIC_KEYS, "grade"),
  ];
  if (problems.length > 0) return { problems };
  return { rubric: { rules: rules.value, requiredSections: sections.value, facts: facts.value, citations: citations.value, penalty: penalty.value } };
};
