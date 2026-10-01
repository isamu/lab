import type { Localized, OptionValue, RuleOption } from "./plugin.ts";

// A rule's options: what its YAML declares, whether a written value fits, and which setting decides each one.
// Pure: no file is read here. The settings come in as layers, strongest first (chaff.yaml, then a style, then the default).

const KINDS: readonly RuleOption["kind"][] = ["choice", "count", "words"];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isLocalized = (value: unknown): value is Localized =>
  isRecord(value) && Object.keys(value).length > 0 && Object.values(value).every((entry) => typeof entry === "string" && entry !== "");

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1;

const isWords = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.trim() !== "");

/** Whether value fits the option: one of the choices, a whole number of 1 or more, or a list of words. */
export const fitsOption = (option: RuleOption, value: unknown): value is OptionValue => {
  if (option.kind === "count") return isCount(value);
  if (option.kind === "words") return isWords(value);
  return typeof value === "string" && option.choices.includes(value);
};

/** What a value must look like, for a problem message: the choices, or the kind. */
export const expectedOf = (option: RuleOption): string => (option.kind === "choice" ? option.choices.join(" / ") : option.kind);

const kindOf = (raw: Record<string, unknown>, where: string): RuleOption["kind"] => {
  const kind = KINDS.find((entry) => entry === raw["kind"]);
  if (kind === undefined) throw new Error(`${where}: kind must be one of ${KINDS.join(", ")}`);
  return kind;
};

const choicesOf = (raw: Record<string, unknown>, kind: RuleOption["kind"], where: string): string[] => {
  if (kind !== "choice") return [];
  const choices = raw["choices"];
  if (!isRecord(choices) || Object.keys(choices).length < 2) throw new Error(`${where}: a choice needs two or more choices, each with its meaning`);
  return Object.keys(choices);
};

const choiceNamesOf = (raw: Record<string, unknown>, where: string): Record<string, Localized> => {
  const choices = raw["choices"];
  if (!isRecord(choices)) return {};
  return Object.fromEntries(
    Object.entries(choices).map(([choice, meaning]) => {
      if (!isLocalized(meaning)) throw new Error(`${where}: choice ${choice} needs its meaning in ja and/or en`);
      return [choice, meaning];
    }),
  );
};

const optionOf = (name: string, raw: unknown, file: string): RuleOption => {
  const where = `${file}: options.${name}`;
  if (!isRecord(raw)) throw new Error(`${where} must be a map`);
  const kind = kindOf(raw, where);
  const about = raw["about"];
  if (!isLocalized(about)) throw new Error(`${where}: about needs what the option decides, in ja and/or en`);
  const option: RuleOption = {
    kind,
    choices: choicesOf(raw, kind, where),
    default: kind === "words" ? [] : 0,
    about,
    choiceNames: kind === "choice" ? choiceNamesOf(raw, where) : {},
  };
  const fallback: unknown = raw["default"] ?? (kind === "words" ? [] : undefined);
  if (!fitsOption(option, fallback)) throw new Error(`${where}: default must be ${expectedOf(option)}`);
  return { ...option, default: fallback };
};

/** The options a rule's YAML declares. A wrong declaration is chaff's own bug, so it throws with the file and the option. */
export const optionsOf = (raw: unknown, file: string): Record<string, RuleOption> => {
  if (raw === undefined) return {};
  if (!isRecord(raw)) throw new Error(`${file}: options must be a map of option names`);
  return Object.fromEntries(Object.entries(raw).map(([name, option]) => [name, optionOf(name, option, file)]));
};

/** One place settings come from, and what it sets: { rule id: { option: value } }. */
export type OptionLayer = { readonly from: string; readonly values: Readonly<Record<string, unknown>> };

export type SettledOption = { readonly value: OptionValue; readonly from: string };

/** The source name of an option left at its default. */
export const DEFAULT_SOURCE = "default";

const optionMap = (layer: OptionLayer, ruleId: string): Readonly<Record<string, unknown>> => {
  const values = layer.values[ruleId];
  return isRecord(values) ? values : {};
};

/**
 * Each option of a rule at the value of the strongest layer that sets it with a value that fits, and where that came from.
 * A value that does not fit falls through to the next layer; optionProblems says so, so it is never silent.
 */
export const settleOptions = (ruleId: string, options: Readonly<Record<string, RuleOption>>, layers: readonly OptionLayer[]): Record<string, SettledOption> =>
  Object.fromEntries(
    Object.entries(options).map(([name, option]) => {
      const fitting = layers.flatMap((layer): SettledOption[] => {
        const value = optionMap(layer, ruleId)[name];
        return fitsOption(option, value) ? [{ value, from: layer.from }] : [];
      });
      return [name, fitting[0] ?? { value: option.default, from: DEFAULT_SOURCE }];
    }),
  );

/** The values alone, as the detector gets them. */
export const optionValues = (settled: Readonly<Record<string, SettledOption>>): Record<string, OptionValue> =>
  Object.fromEntries(Object.entries(settled).map(([name, entry]) => [name, entry.value]));

/** What a layer sets that has no effect: an unknown rule, a rule with no options, an unknown option, or a value that does not fit. */
export type OptionProblem =
  | { readonly kind: "unknown-rule"; readonly rule: string }
  | { readonly kind: "no-options"; readonly rule: string }
  | { readonly kind: "not-a-map"; readonly rule: string }
  | { readonly kind: "unknown-option"; readonly rule: string; readonly option: string; readonly known: readonly string[] }
  | { readonly kind: "bad-value"; readonly rule: string; readonly option: string; readonly value: string; readonly expected: string };

const printed = (value: unknown): string => JSON.stringify(value) ?? String(value);

const problemsOfRule = (ruleId: string, options: Readonly<Record<string, RuleOption>> | undefined, written: unknown): OptionProblem[] => {
  if (options === undefined) return [{ kind: "unknown-rule", rule: ruleId }];
  if (Object.keys(options).length === 0) return [{ kind: "no-options", rule: ruleId }];
  if (!isRecord(written)) return [{ kind: "not-a-map", rule: ruleId }];
  return Object.entries(written).flatMap(([name, value]): OptionProblem[] => {
    const option = options[name];
    if (option === undefined) return [{ kind: "unknown-option", rule: ruleId, option: name, known: Object.keys(options) }];
    return fitsOption(option, value) ? [] : [{ kind: "bad-value", rule: ruleId, option: name, value: printed(value), expected: expectedOf(option) }];
  });
};

/** Every problem in what a layer sets, given each known rule's options (a rule with none maps to {}). */
export const optionProblems = (layer: OptionLayer, known: Readonly<Record<string, Readonly<Record<string, RuleOption>>>>): OptionProblem[] =>
  Object.entries(layer.values).flatMap(([ruleId, written]) => problemsOfRule(ruleId, known[ruleId], written));
