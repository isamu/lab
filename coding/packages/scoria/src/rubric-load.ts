import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import type { Rubric, RubricStatus, MetricRule, Scale } from "./rubric.ts";

const WEIGHT_EPSILON = 1e-6;
const STATUSES: readonly RubricStatus[] = ["experimental", "stable", "deprecated"];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isStatus = (value: unknown): value is RubricStatus => typeof value === "string" && STATUSES.some((s) => s === value);

const isScale = (value: unknown): value is Scale => isRecord(value) && typeof value["good"] === "number" && typeof value["bad"] === "number";

const isMetricRule = (value: unknown): value is MetricRule =>
  isRecord(value) && typeof value["metric"] === "string" && typeof value["weight"] === "number" && isScale(value["scale"]);

const isStringArray = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every((v) => typeof v === "string");

const parseRubric = (source: string, text: string): Rubric => {
  const raw: unknown = parse(text);
  if (!isRecord(raw) || typeof raw["id"] !== "string" || !isStatus(raw["status"])) {
    throw new Error(`${source}: rubric needs a string "id" and a status of ${STATUSES.join(" | ")}`);
  }
  const metrics = raw["metrics"];
  if (!Array.isArray(metrics) || !metrics.every(isMetricRule)) {
    throw new Error(`${source}: every entry of "metrics" needs { metric, scale: { good, bad }, weight }`);
  }
  const confidenceFrom = raw["confidence_from"];
  return {
    id: raw["id"],
    status: raw["status"],
    metrics,
    confidenceFrom: isStringArray(confidenceFrom) ? confidenceFrom : [],
  };
};

/** weight の合計が 1 でないと Σ points == score が崩れ、movers の加法性（spec §26.3）が壊れる。 */
const assertWeightsSumToOne = (rubric: Rubric, source: string): void => {
  const sum = rubric.metrics.reduce((acc, m) => acc + m.weight, 0);
  if (Math.abs(sum - 1) > WEIGHT_EPSILON) {
    throw new Error(`${source}: weights must sum to 1, got ${sum}`);
  }
};

/**
 * rubric が参照する metric id がどの probe の declares にも無い場合、その metric は静かに 0 点になる。
 * 最も見つけにくい壊れ方なので、起動時に落とす（spec §26.2）。
 */
export const assertMetricsAreDeclared = (rubrics: readonly Rubric[], declared: ReadonlySet<string>): void => {
  const missing = rubrics.flatMap((r) => r.metrics.filter((m) => !declared.has(m.metric)).map((m) => `${r.id} -> ${m.metric}`));
  if (missing.length > 0) {
    throw new Error(`rubric references metrics that no probe declares:\n  ${missing.join("\n  ")}`);
  }
};

export const loadRubrics = async (directory: string): Promise<readonly Rubric[]> => {
  const entries = await readdir(directory);
  const files = entries.filter((name) => name.endsWith(".yaml")).sort((a, b) => a.localeCompare(b));
  return Promise.all(
    files.map(async (name) => {
      const source = join(directory, name);
      const rubric = parseRubric(name, await readFile(source, "utf8"));
      assertWeightsSumToOne(rubric, name);
      return rubric;
    }),
  );
};
