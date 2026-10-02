// The numbers behind `yarn rules:measure`: on how many human documents of each genre group a rule fires, and how its
// findings fared in the bench and the AI-shape bench. Pure; scripts/rules-measure.ts runs chaff and reads the files.

/** One document's run: its genre group, the rules that ran on it and the rules that reported on it. */
export type DocumentRun = { readonly group: string; readonly ran: ReadonlySet<string>; readonly fired: ReadonlySet<string> };

/** Of the documents of one group a rule ran on, how many it reported on. */
export type GroupShare = { readonly documents: number; readonly fired: number };

/** The bench's row for a rule (test/fixtures/bench/expected/<rule>.txt): its planted mistakes and its findings on clean samples. */
export type BenchRow = { readonly planted: number; readonly found: number; readonly falseAlarms: number };

/** The AI-shape bench's row for a rule, both languages together: hits on generated-style text, alarms on the human and rewritten text. */
export type AiBenchRow = { readonly hits: number; readonly samples: number; readonly falseAlarms: number; readonly cleanSamples: number };

export type RuleMeasure = {
  readonly groups: Readonly<Record<string, GroupShare>>;
  readonly bench?: BenchRow;
  readonly aiBench?: AiBenchRow;
  /** Of the baseline documents (--baseline), how many it ran on and reported on. Never committed. */
  readonly baseline?: GroupShare;
};

export type Measurement = { readonly rules: Readonly<Record<string, RuleMeasure>> };

const byId = (left: string, right: string): number => left.localeCompare(right, "en");

const countRun = (shares: Map<string, Map<string, GroupShare>>, run: DocumentRun): Map<string, Map<string, GroupShare>> => {
  run.ran.forEach((rule) => {
    const groups = shares.get(rule) ?? new Map<string, GroupShare>();
    const share = groups.get(run.group) ?? { documents: 0, fired: 0 };
    groups.set(run.group, { documents: share.documents + 1, fired: share.fired + (run.fired.has(rule) ? 1 : 0) });
    shares.set(rule, groups);
  });
  return shares;
};

const sortedRecord = <T>(entries: Iterable<readonly [string, T]>): Record<string, T> =>
  Object.fromEntries([...entries].toSorted(([left], [right]) => byId(left, right)));

/** Per rule and group, the documents the rule ran on and the ones it reported on. A rule that ran nowhere is absent. */
export const groupShares = (runs: readonly DocumentRun[]): Record<string, Record<string, GroupShare>> =>
  sortedRecord(
    [...runs.reduce(countRun, new Map<string, Map<string, GroupShare>>()).entries()].map(([rule, groups]) => [rule, sortedRecord(groups.entries())] as const),
  );

/** Per rule, over every document given, ignoring the group: what the baseline column shows. */
export const overallShares = (runs: readonly DocumentRun[]): Record<string, GroupShare> =>
  sortedRecord(
    Object.entries(groupShares(runs.map((run) => ({ ...run, group: "all" })))).flatMap(([rule, groups]) =>
      groups["all"] === undefined ? [] : [[rule, groups["all"]] as const],
    ),
  );

const BENCH_ROW = /^table {2}(\d+) {2}(\d+) {2}(\d+) {2}(\d+)$/u;

/** The table line of a rule's bench file ("table  planted found missed alarms"), or undefined when it has none. */
export const benchRowOf = (text: string): BenchRow | undefined => {
  const match = BENCH_ROW.exec(text.split("\n").find((line) => BENCH_ROW.test(line)) ?? "");
  if (match === null) return undefined;
  const [planted = 0, found = 0, , falseAlarms = 0] = match.slice(1).map(Number);
  return { planted, found, falseAlarms };
};

const AI_ROW = /^(\S+) +(\d+)\/(\d+) +(\d+)\/(\d+) +(\d+)\/(\d+) +\d+\/\d+$/u;

const addAiRow = (rows: Map<string, AiBenchRow>, line: string): Map<string, AiBenchRow> => {
  const match = AI_ROW.exec(line);
  if (match === null) return rows;
  const [hits = 0, samples = 0, human = 0, humanOf = 0, rewritten = 0, rewrittenOf = 0] = match.slice(2).map(Number);
  const rule = match[1] ?? "";
  const before = rows.get(rule) ?? { hits: 0, samples: 0, falseAlarms: 0, cleanSamples: 0 };
  return rows.set(rule, {
    hits: before.hits + hits,
    samples: before.samples + samples,
    falseAlarms: before.falseAlarms + human + rewritten,
    cleanSamples: before.cleanSamples + humanOf + rewrittenOf,
  });
};

/** test/fixtures/ai-samples/paired/expected.txt as one row per rule, the languages added together. Its corpus column is left out: the corpus is measured directly. */
export const aiBenchRows = (text: string): Record<string, AiBenchRow> =>
  sortedRecord(text.split("\n").reduce(addAiRow, new Map<string, AiBenchRow>()).entries());

/** Of a rule's findings in a bench, the share that were right: found plants over found plants and false alarms. Undefined when it reported nothing. */
export const benchPrecision = (measure: Pick<RuleMeasure, "bench" | "aiBench">): number | undefined => {
  const right = (measure.bench?.found ?? 0) + (measure.aiBench?.hits ?? 0);
  const wrong = (measure.bench?.falseAlarms ?? 0) + (measure.aiBench?.falseAlarms ?? 0);
  return right + wrong === 0 ? undefined : right / (right + wrong);
};

export const shareOf = (share: GroupShare): number => (share.documents === 0 ? 0 : share.fired / share.documents);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isCounts = (value: unknown, fields: readonly string[]): boolean => isRecord(value) && fields.every((field) => typeof value[field] === "number");

const isGroupShare = (value: unknown): value is GroupShare => isCounts(value, ["documents", "fired"]);

const isRuleMeasure = (value: unknown): value is RuleMeasure =>
  isRecord(value) &&
  isRecord(value["groups"]) &&
  Object.values(value["groups"]).every(isGroupShare) &&
  (value["bench"] === undefined || isCounts(value["bench"], ["planted", "found", "falseAlarms"])) &&
  (value["aiBench"] === undefined || isCounts(value["aiBench"], ["hits", "samples", "falseAlarms", "cleanSamples"])) &&
  (value["baseline"] === undefined || isGroupShare(value["baseline"]));

export const isMeasurement = (value: unknown): value is Measurement =>
  isRecord(value) && isRecord(value["rules"]) && Object.values(value["rules"]).every(isRuleMeasure);

/** The measurement without the baseline: what is committed carries no number from a document that may not be shared. */
export const withoutBaseline = (measurement: Measurement): Measurement => ({
  rules: Object.fromEntries(
    Object.entries(measurement.rules).map(([rule, measure]) => [
      rule,
      {
        groups: measure.groups,
        ...(measure.bench === undefined ? {} : { bench: measure.bench }),
        ...(measure.aiBench === undefined ? {} : { aiBench: measure.aiBench }),
      },
    ]),
  ),
});
