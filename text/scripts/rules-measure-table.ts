// The table `yarn rules:measure` prints: a Markdown table, one row per rule. Pure.
import { MIN_DOCUMENTS, type Standing } from "./rule-policy.ts";
import { benchPrecision, shareOf, type GroupShare, type Measurement, type RuleMeasure } from "./rules-measure-score.ts";

const PERCENT = 100;
const NONE = "–";

const percent = (share: number): string => `${String(Math.round(share * PERCENT))}%`;

/** "12% 3/25"; a group too small to decide is in parentheses. */
const shareCell = (share: GroupShare | undefined): string => {
  if (share === undefined || share.documents === 0) return NONE;
  const cell = `${percent(shareOf(share))} ${String(share.fired)}/${String(share.documents)}`;
  return share.documents < MIN_DOCUMENTS ? `(${cell})` : cell;
};

const benchCell = (measure: RuleMeasure): string => {
  const precision = benchPrecision(measure);
  if (precision === undefined) return NONE;
  const missed = measure.bench === undefined ? 0 : measure.bench.planted - measure.bench.found;
  return missed === 0 ? percent(precision) : `${percent(precision)}, ${String(missed)} missed`;
};

const decisionCell = (standing: Standing | undefined): string => {
  if (standing === undefined) return NONE;
  if (standing.kind !== "normal" && standing.kind !== "info") return standing.kind;
  return standing.off.length === 0 ? standing.kind : `${standing.kind}, off: ${standing.off.join(" ")}`;
};

/** The groups measured, in the order genres.yaml lists them and any other after. */
const groupsOf = (measurement: Measurement, order: readonly string[]): string[] => {
  const seen = new Set(Object.values(measurement.rules).flatMap((measure) => Object.keys(measure.groups)));
  return [
    ...order.filter((group) => seen.has(group)),
    ...[...seen].filter((group) => !order.includes(group)).toSorted((left, right) => left.localeCompare(right, "en")),
  ];
};

const GROUP_ORDER: readonly string[] = ["technical", "blog", "business", "legal", "docs", "academic", "literature", "speech"];

export const formatMeasureTable = (measurement: Measurement, standings: ReadonlyMap<string, Standing>, statuses: ReadonlyMap<string, string>): string[] => {
  const groups = groupsOf(measurement, GROUP_ORDER);
  const withBaseline = Object.values(measurement.rules).some((measure) => measure.baseline !== undefined);
  const header = ["rule", "status", ...groups, "bench", ...(withBaseline ? ["baseline"] : []), "decision"];
  const rows = Object.entries(measurement.rules).map(([rule, measure]) => [
    rule,
    statuses.get(rule) ?? NONE,
    ...groups.map((group) => shareCell(measure.groups[group])),
    benchCell(measure),
    ...(withBaseline ? [shareCell(measure.baseline)] : []),
    decisionCell(standings.get(rule)),
  ]);
  return [header, header.map(() => "---"), ...rows].map((cells) => `| ${cells.join(" | ")} |`);
};
