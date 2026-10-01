// The discrimination table of the AI-shape rules: for each rule, how often it fires on the generated-style samples
// (hits) and on the human-style, rewritten and human corpus documents (false alarms). Pure: the caller runs chaff.

/** Which pile a document belongs to. ai: (b) generated style; human: (a); rewritten: (c); corpus: real human documents. */
export const PILES = ["ai", "human", "rewritten", "corpus"] as const;
export type Pile = (typeof PILES)[number];

/** One document and the AI-shape rules that fired on it. */
export type BenchRun = { readonly pile: Pile; readonly id: string; readonly fired: ReadonlySet<string> };

export type Rate = { readonly fired: number; readonly of: number };

export type RuleRow = { readonly rule: string; readonly rates: Readonly<Record<Pile, Rate>> };

const rateOf = (runs: readonly BenchRun[], pile: Pile, rule: string): Rate => {
  const inPile = runs.filter((run) => run.pile === pile);
  return { fired: inPile.filter((run) => run.fired.has(rule)).length, of: inPile.length };
};

/** One row per rule, in the order given. */
export const ruleRows = (runs: readonly BenchRun[], rules: readonly string[]): RuleRow[] =>
  rules.map((rule) => ({
    rule,
    rates: {
      ai: rateOf(runs, "ai", rule),
      human: rateOf(runs, "human", rule),
      rewritten: rateOf(runs, "rewritten", rule),
      corpus: rateOf(runs, "corpus", rule),
    },
  }));

const cell = (rate: Rate): string => `${String(rate.fired)}/${String(rate.of)}`;

const COLUMN_TITLES: Readonly<Record<Pile, string>> = { ai: "hits (b) ai", human: "false (a) human", rewritten: "false (c) rewritten", corpus: "false corpus" };

/** The table as fixed-width lines with a header: one row per rule, one column per pile. */
export const formatRows = (rows: readonly RuleRow[]): string[] => {
  const width = Math.max("rule".length, ...rows.map((row) => row.rule.length));
  const header = ["rule".padEnd(width), ...PILES.map((pile) => COLUMN_TITLES[pile])].join("  ");
  const lines = rows.map((row) =>
    [row.rule.padEnd(width), ...PILES.map((pile) => cell(row.rates[pile]).padEnd(COLUMN_TITLES[pile].length))].join("  ").trimEnd(),
  );
  return [header, ...lines];
};

/** The rules that fired on a pile's documents, by document: the evidence behind a row. */
export const firedOn = (runs: readonly BenchRun[], pile: Pile): string[] =>
  runs
    .filter((run) => run.pile === pile && run.fired.size > 0)
    .map((run) => `${run.id}: ${[...run.fired].toSorted((left, right) => left.localeCompare(right)).join(", ")}`);
