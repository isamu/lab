// Scoring for `yarn bench`: whether chaff found each planted mistake, the per-rule table, and the summary that is
// compared with test/fixtures/bench/expected/. Pure; scripts/bench.ts runs chaff and reads and writes the files.

export type Located = { readonly rule: string; readonly line: number };

/** How far from the planted line a finding may be and still count as finding it. */
export const NEAR_LINES = 1;

export type Outcome = {
  readonly sample: string;
  readonly mutation: string;
  readonly rule: string;
  readonly found: boolean;
  /** Where the target rule did report, when it reported only away from the planted line. */
  readonly elsewhere: readonly number[];
};

export type RuleRow = { readonly rule: string; readonly planted: number; readonly found: number; readonly missed: number; readonly falseAlarms: number };

/** Where a mistake was planted: a line, or "document" for a rule that reports on the whole document. */
export type Planted = { readonly rule: string; readonly line: number | "document" };

const isNear = (finding: Located, planted: Planted): boolean =>
  finding.rule === planted.rule && (planted.line === "document" || Math.abs(finding.line - planted.line) <= NEAR_LINES);

/** One planted mistake: found when its rule reports at or next to the planted line, or anywhere for a "document" plant. */
export const outcomeOf = (sample: string, mutation: string, planted: Planted, findings: readonly Located[]): Outcome => {
  const found = findings.some((finding) => isNear(finding, planted));
  const elsewhere = found ? [] : findings.filter((finding) => finding.rule === planted.rule).map((finding) => finding.line);
  return { sample, mutation, rule: planted.rule, found, elsewhere };
};

/** Findings of the measured rules on the clean samples. Each one is a false alarm: the samples have no mistake. */
export const falseAlarms = (clean: readonly Located[], measured: ReadonlySet<string>): ReadonlyMap<string, number> =>
  clean
    .filter((finding) => measured.has(finding.rule))
    .reduce((counts, finding) => counts.set(finding.rule, (counts.get(finding.rule) ?? 0) + 1), new Map<string, number>());

const rowOf = (rule: string, outcomes: readonly Outcome[], alarms: ReadonlyMap<string, number>): RuleRow => {
  const planted = outcomes.filter((outcome) => outcome.rule === rule);
  const found = planted.filter((outcome) => outcome.found).length;
  return { rule, planted: planted.length, found, missed: planted.length - found, falseAlarms: alarms.get(rule) ?? 0 };
};

/** One row per measured rule, in the order of the rule ids. */
export const ruleTable = (measured: ReadonlySet<string>, outcomes: readonly Outcome[], alarms: ReadonlyMap<string, number>): RuleRow[] =>
  [...measured].toSorted((left, right) => left.localeCompare(right, "en")).map((rule) => rowOf(rule, outcomes, alarms));

const COLUMNS: readonly string[] = ["rule", "planted", "found", "missed", "false alarms"];

const cellsOf = (row: RuleRow): string[] => [row.rule, String(row.planted), String(row.found), String(row.missed), String(row.falseAlarms)];

/** The table as aligned text: the rule left-aligned, the counts right-aligned. */
export const formatTable = (rows: readonly RuleRow[]): string[] => {
  const table = [[...COLUMNS], ...rows.map(cellsOf)];
  const widths = COLUMNS.map((_, column) => Math.max(...table.map((cells) => (cells[column] ?? "").length)));
  return table.map((cells) =>
    cells
      .map((cell, column) => (column === 0 ? cell.padEnd(widths[column] ?? 0) : cell.padStart(widths[column] ?? 0)))
      .join("  ")
      .trimEnd(),
  );
};

/** One line per planted mistake, so that a change in any single one shows up. */
export const outcomeLine = (outcome: Outcome): string => {
  const where = outcome.elsewhere.length === 0 ? "" : ` (reported at line ${outcome.elsewhere.join(", ")})`;
  return `${outcome.sample}  ${outcome.mutation}  ${outcome.found ? "found" : "missed"}${where}`;
};

/** A clean sample's line: "clean", or the measured rules that reported on it. */
export const cleanLine = (sample: string, clean: readonly Located[], measured: ReadonlySet<string>): string => {
  const counts = falseAlarms(clean, measured);
  const parts = [...counts.keys()].toSorted((left, right) => left.localeCompare(right, "en")).map((rule) => `${rule} ${String(counts.get(rule) ?? 0)}`);
  return `${sample}  clean sample  ${parts.length === 0 ? "clean" : parts.join(", ")}`;
};

/** Lines only in the expectation (-) or only in this run (+). */
export const summaryChanges = (expected: readonly string[], actual: readonly string[]): string[] => [
  ...expected.filter((line) => !actual.includes(line)).map((line) => `- ${line}`),
  ...actual.filter((line) => !expected.includes(line)).map((line) => `+ ${line}`),
];
