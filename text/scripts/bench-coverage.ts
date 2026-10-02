// Which rules `yarn bench` must plant a mistake for (test/fixtures/bench/plants/<rule>.yaml), and what is wrong when it does not.
// A rule whose plant never lands (no sample qualifies, a sample changed) would otherwise just leave the table. Pure.

const PLANTS_FILE = "test/fixtures/bench/plants/";

/** planted: the rules the bench plants, with the languages it must plant them in. notPlanted: the other rules, with why. */
export type PlantPlan = { readonly planted: Readonly<Record<string, readonly string[]>>; readonly notPlanted: Readonly<Record<string, string>> };

type Mutated = { readonly rule: string; readonly languages: readonly string[] };

type Planted = { readonly sample: string; readonly rule: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isLanguageList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === "string" && entry !== "");

const sectionOf = (raw: Record<string, unknown>, key: string): Record<string, unknown> => {
  const section = raw[key];
  if (!isRecord(section)) throw new Error(`${PLANTS_FILE}: ${key} must map rule ids`);
  return section;
};

const checked = <T>(section: Record<string, unknown>, isValid: (value: unknown) => value is T, what: string): Record<string, T> =>
  Object.fromEntries(
    Object.entries(section).map(([rule, value]) => {
      if (!isValid(value)) throw new Error(`${PLANTS_FILE}: ${rule} needs ${what}`);
      return [rule, value];
    }),
  );

const isReason = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

/** The parsed plants.yaml. Throws on anything else, so that a malformed list never reads as "nothing expected". */
export const planOf = (raw: unknown): PlantPlan => {
  if (!isRecord(raw)) throw new Error(`${PLANTS_FILE}: needs planted and not_planted`);
  return {
    planted: checked(sectionOf(raw, "planted"), isLanguageList, "a list of languages"),
    notPlanted: checked(sectionOf(raw, "not_planted"), isReason, "a reason"),
  };
};

/**
 * The plan from one file per rule (test/fixtures/bench/plants/<rule>.yaml), by rule id: each file holds either
 * `planted: [languages]` or `not_planted: reason`, so a new rule adds its own file and edits no shared list.
 */
export const planOfFiles = (files: ReadonlyMap<string, unknown>): PlantPlan => {
  const entries = [...files.entries()].map(([rule, raw]) => {
    const keys = isRecord(raw) ? Object.keys(raw) : [];
    const [key] = keys;
    if (!isRecord(raw) || keys.length !== 1 || (key !== "planted" && key !== "not_planted"))
      throw new Error(`${PLANTS_FILE}${rule}.yaml: needs planted or not_planted, and only one of them`);
    return { rule, key, value: raw[key] };
  });
  const section = (key: string): Record<string, unknown> =>
    Object.fromEntries(entries.filter((entry) => entry.key === key).map((entry) => [entry.rule, entry.value]));
  return planOf({ planted: section("planted"), not_planted: section("not_planted") });
};

const listingProblems = (plan: PlantPlan, rules: readonly string[]): string[] => {
  const listed = [...Object.keys(plan.planted), ...Object.keys(plan.notPlanted)];
  return [
    ...rules.filter((rule) => !listed.includes(rule)).map((rule) => `${rule}: no ${PLANTS_FILE}${rule}.yaml (planted or not_planted)`),
    ...listed.filter((rule) => !rules.includes(rule)).map((rule) => `${rule}: in ${PLANTS_FILE} but no such rule`),
    ...Object.keys(plan.planted)
      .filter((rule) => Object.hasOwn(plan.notPlanted, rule))
      .map((rule) => `${rule}: both planted and not_planted in ${PLANTS_FILE}`),
  ];
};

const mutationProblems = (plan: PlantPlan, mutations: readonly Mutated[]): string[] => [
  ...Object.entries(plan.planted).flatMap(([rule, languages]) =>
    languages
      .filter((language) => !mutations.some((mutation) => mutation.rule === rule && mutation.languages.includes(language)))
      .map((language) => `${rule}: no mutation plants it in ${language}`),
  ),
  ...Object.keys(plan.notPlanted)
    .filter((rule) => mutations.some((mutation) => mutation.rule === rule))
    .map((rule) => `${rule}: listed as not_planted, but a mutation plants it`),
];

/** Disagreements between the plan, chaff's rules and the bench's mutations. Checked without running chaff. */
export const planProblems = (plan: PlantPlan, rules: readonly string[], mutations: readonly Mutated[]): string[] => [
  ...listingProblems(plan, rules),
  ...mutationProblems(plan, mutations),
];

const languageOf = (sample: string): string => sample.split("/")[0] ?? "";

/** The planted rules that a bench run planted in no sample of one of their languages. */
export const unplanted = (plan: PlantPlan, outcomes: readonly Planted[]): string[] =>
  Object.entries(plan.planted).flatMap(([rule, languages]) =>
    languages
      .filter((language) => !outcomes.some((outcome) => outcome.rule === rule && languageOf(outcome.sample) === language))
      .map((language) => `${rule}: planted in no ${language} sample`),
  );
