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

type FactLimits = {
  readonly dropped?: number | undefined;
  readonly added?: number | undefined;
  readonly allowDropped: readonly AtomKind[];
  readonly allowAdded: readonly AtomKind[];
};

type CitationLimits = { readonly failed?: number | undefined; readonly required: boolean };

type ContextLimits = { readonly unsupported?: number | undefined; readonly allowUnsupported: readonly AtomKind[]; readonly required: boolean };

export type Rubric = {
  readonly rules: Readonly<Record<string, RuleLimit>>;
  /** Undefined when not written: chaff.yaml's top-level required_sections apply. */
  readonly requiredSections?: readonly string[] | undefined;
  readonly facts?: FactLimits | undefined;
  readonly citations?: CitationLimits | undefined;
  readonly contexts?: ContextLimits | undefined;
  readonly penalty?: number | undefined;
  /** Each task's own rubric, as written: what it does not write comes from the top level (task-rubric.ts). */
  readonly tasks?: Readonly<Record<string, Rubric>> | undefined;
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

const rulesOf = (raw: unknown, base: string): Read<Record<string, RuleLimit>> => {
  if (raw === undefined) return ok({});
  if (!isRecord(raw)) return { value: {}, problems: [problem(`${base}.rules`, "map", raw)] };
  const read = Object.entries(raw).map(([id, limit]) => ({ id, read: ruleLimit(limit, `${base}.rules.${id}`) }));
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

const factsOf = (raw: unknown, base: string): Read<FactLimits | undefined> => {
  if (raw === undefined) return ok(undefined);
  const path = `${base}.facts`;
  if (!isRecord(raw)) return { value: undefined, problems: [problem(path, "map", raw)] };
  const dropped = optional(raw, "dropped", path, "count");
  const added = optional(raw, "added", path, "count");
  const allowDropped = kindsOf(raw["allow_dropped"], `${path}.allow_dropped`);
  const allowAdded = kindsOf(raw["allow_added"], `${path}.allow_added`);
  return {
    value: { dropped: dropped.value, added: added.value, allowDropped: allowDropped.value, allowAdded: allowAdded.value },
    problems: [
      ...dropped.problems,
      ...added.problems,
      ...allowDropped.problems,
      ...allowAdded.problems,
      ...unknownKeys(raw, ["dropped", "added", "allow_dropped", "allow_added"], path),
    ],
  };
};

/** `required: true|false` under `path`: false when not written. */
const requiredOf = (raw: Record<string, unknown>, path: string): Read<boolean> => {
  const required = raw["required"];
  return required === undefined || typeof required === "boolean"
    ? ok(required === true)
    : { value: false, problems: [problem(`${path}.required`, "boolean", required)] };
};

const citationsOf = (raw: unknown, base: string): Read<CitationLimits | undefined> => {
  if (raw === undefined) return ok(undefined);
  const path = `${base}.citations`;
  if (!isRecord(raw)) return { value: undefined, problems: [problem(path, "map", raw)] };
  const failed = optional(raw, "failed", path, "count");
  const required = requiredOf(raw, path);
  return {
    value: { failed: failed.value, required: required.value },
    problems: [...failed.problems, ...required.problems, ...unknownKeys(raw, ["failed", "required"], path)],
  };
};

const contextsOf = (raw: unknown, base: string): Read<ContextLimits | undefined> => {
  if (raw === undefined) return ok(undefined);
  const path = `${base}.contexts`;
  if (!isRecord(raw)) return { value: undefined, problems: [problem(path, "map", raw)] };
  const unsupported = optional(raw, "unsupported", path, "count");
  const allowUnsupported = kindsOf(raw["allow_unsupported"], `${path}.allow_unsupported`);
  const required = requiredOf(raw, path);
  return {
    value: { unsupported: unsupported.value, allowUnsupported: allowUnsupported.value, required: required.value },
    problems: [
      ...unsupported.problems,
      ...allowUnsupported.problems,
      ...required.problems,
      ...unknownKeys(raw, ["unsupported", "allow_unsupported", "required"], path),
    ],
  };
};

/** The keys a task's rubric may write: every top-level key but `tasks`, so a task cannot hold tasks of its own. */
const TASK_KEYS: readonly string[] = ["rules", "required_sections", "facts", "citations", "contexts", "penalty"];

const RUBRIC_KEYS: readonly string[] = [...TASK_KEYS, "tasks"];

/** One rubric's keys under `base` (`grade`, or `grade.tasks.<name>`); a key not among `keys` is a problem. */
const rubricAt = (raw: Record<string, unknown>, base: string, keys: readonly string[]): Read<Rubric> => {
  const rules = rulesOf(raw["rules"], base);
  const sections = wordsOf(raw["required_sections"], `${base}.required_sections`);
  const facts = factsOf(raw["facts"], base);
  const citations = citationsOf(raw["citations"], base);
  const contexts = contextsOf(raw["contexts"], base);
  const penalty = optional(raw, "penalty", base, "number");
  return {
    value: {
      rules: rules.value,
      requiredSections: sections.value,
      facts: facts.value,
      citations: citations.value,
      contexts: contexts.value,
      penalty: penalty.value,
    },
    problems: [
      ...rules.problems,
      ...sections.problems,
      ...facts.problems,
      ...citations.problems,
      ...contexts.problems,
      ...penalty.problems,
      ...unknownKeys(raw, keys, base),
    ],
  };
};

/** One task's rubric. A bare `<name>:` (null) writes nothing, so the task inherits the whole top-level rubric. */
const taskOf = (raw: unknown, path: string): Read<Rubric> => {
  if (raw === null) return ok({ rules: {} });
  if (!isRecord(raw)) return { value: { rules: {} }, problems: [problem(path, "map", raw)] };
  return rubricAt(raw, path, TASK_KEYS);
};

const tasksOf = (raw: unknown): Read<Record<string, Rubric> | undefined> => {
  if (raw === undefined) return ok(undefined);
  if (!isRecord(raw)) return { value: undefined, problems: [problem("grade.tasks", "map", raw)] };
  const read = Object.entries(raw).map(([name, task]) => ({ name, read: taskOf(task, `grade.tasks.${name}`) }));
  return { value: Object.fromEntries(read.map((entry) => [entry.name, entry.read.value])), problems: read.flatMap((entry) => entry.read.problems) };
};

/**
 * The rubric, or every problem in it. No `grade:` key is no rubric: the default pass or fail applies (spec §29.3). A bare
 * `grade:` (null) is an empty rubric, so writing the key alone still turns the default off, as the spec says it does.
 */
export const parseRubric = (raw: unknown): { readonly rubric: Rubric | undefined } | { readonly problems: readonly RubricProblem[] } => {
  if (raw === undefined) return { rubric: undefined };
  if (raw === null) return { rubric: { rules: {} } };
  if (!isRecord(raw)) return { problems: [problem("grade", "map", raw)] };
  const top = rubricAt(raw, "grade", RUBRIC_KEYS);
  const tasks = tasksOf(raw["tasks"]);
  const problems = [...top.problems, ...tasks.problems];
  if (problems.length > 0) return { problems };
  return { rubric: tasks.value === undefined ? top.value : { ...top.value, tasks: tasks.value } };
};
