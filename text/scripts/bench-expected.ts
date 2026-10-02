// test/fixtures/bench/expected/ holds the bench's expected summary split by rule, so a PR that adds or changes one
// rule edits that rule's file only. <rule>.txt holds the rule's table row ("table  planted found missed alarms") and
// the outcome of each of its mutations on each sample; _samples.txt holds the clean samples' lines, in sample order.
// The table is re-aligned when the files are joined, so a longer rule id does not rewrite every other rule's file.
import { formatTable, type RuleRow } from "./bench-score.ts";

/** The clean samples' lines. A rule id never starts with "_". */
export const SAMPLES_FILE = "_samples.txt";
/** Outcome lines of a mutation the bench no longer has; kept so the comparison still reports them as gone. */
export const OTHER_FILE = "_other.txt";

const SEPARATOR = "  ";
const TABLE = "table";
const ROW = /^(\S+) +(\d+) +(\d+) +(\d+) +(\d+)$/u;
const HEADER = /^rule +planted +found +missed +false alarms$/u;
const CLEAN_SAMPLE = `${SEPARATOR}clean sample${SEPARATOR}`;

const append = (files: Map<string, string[]>, name: string, line: string): Map<string, string[]> => files.set(name, [...(files.get(name) ?? []), line]);

const fileOfLine = (line: string, ruleOfMutation: ReadonlyMap<string, string>): [string, string] | undefined => {
  if (HEADER.test(line)) return undefined;
  const row = ROW.exec(line);
  if (row !== null) return [`${row[1] ?? ""}.txt`, [TABLE, ...row.slice(2)].join(SEPARATOR)];
  if (line.includes(CLEAN_SAMPLE)) return [SAMPLES_FILE, line];
  const rule = ruleOfMutation.get(line.split(SEPARATOR)[1] ?? "");
  return [rule === undefined ? OTHER_FILE : `${rule}.txt`, line];
};

/** The summary lines (table, clean samples, outcomes) as file name → lines. ruleOfMutation maps a mutation id to its rule. */
export const splitBenchSummary = (lines: readonly string[], ruleOfMutation: ReadonlyMap<string, string>): Map<string, string[]> =>
  lines.reduce((files, line) => {
    const placed = fileOfLine(line, ruleOfMutation);
    return placed === undefined ? files : append(files, ...placed);
  }, new Map<string, string[]>());

const rowOf = (rule: string, line: string): RuleRow => {
  const [planted = 0, found = 0, missed = 0, falseAlarms = 0] = line.split(SEPARATOR).slice(1).map(Number);
  return { rule, planted, found, missed, falseAlarms };
};

/** Each rule's file as [rule id, lines], in rule id order (the order of the table). */
const ruleFiles = (files: ReadonlyMap<string, readonly string[]>): [string, readonly string[]][] =>
  [...files.entries()]
    .filter(([name]) => !name.startsWith("_"))
    .map(([name, lines]): [string, readonly string[]] => [name.slice(0, -".txt".length), lines])
    .toSorted(([left], [right]) => left.localeCompare(right, "en"));

/** Where an outcome line goes in the summary: by its sample's place among the clean samples, then its mutation's place. */
const outcomeOrder = (samples: readonly string[], mutations: readonly string[]) => {
  const rank = (line: string): [number, number] => {
    const [sample = "", mutation = ""] = line.split(SEPARATOR);
    return [samples.indexOf(sample), mutations.indexOf(mutation)];
  };
  return (left: string, right: string): number => {
    const [leftSample, leftMutation] = rank(left);
    const [rightSample, rightMutation] = rank(right);
    return leftSample - rightSample || leftMutation - rightMutation;
  };
};

/**
 * The summary lines back from the split files, as scripts/bench.ts writes them: the table, the clean samples, then each
 * sample's outcomes in the order of mutationIds (the bench's MUTATIONS).
 */
export const joinBenchSummary = (files: ReadonlyMap<string, readonly string[]>, mutationIds: readonly string[]): string[] => {
  const rules = ruleFiles(files);
  const rows = rules.flatMap(([rule, lines]) => lines.filter((line) => line.startsWith(`${TABLE}${SEPARATOR}`)).map((line) => rowOf(rule, line)));
  const cleanLines = files.get(SAMPLES_FILE) ?? [];
  const samples = cleanLines.map((line) => line.split(SEPARATOR)[0] ?? "");
  const outcomes = [...rules.flatMap(([, lines]) => lines.filter((line) => !line.startsWith(`${TABLE}${SEPARATOR}`))), ...(files.get(OTHER_FILE) ?? [])];
  return [...(rows.length === 0 ? [] : formatTable(rows)), ...cleanLines, ...outcomes.toSorted(outcomeOrder(samples, mutationIds))];
};
