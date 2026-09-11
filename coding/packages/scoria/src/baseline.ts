import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Report } from "./report.ts";
import { isRecord } from "./package-json.ts";

/**
 * The previous run, committed to the repository (spec §17).
 *
 * A single score says almost nothing; the point of the tool is the direction of travel. The whole
 * report is stored rather than a summary, because the delta has to be attributable down to the
 * metric that moved and the files behind it — a stored score alone cannot say what changed.
 */

export const BASELINE_PATH = join(".scoria", "baseline.json");

export interface Baseline {
  readonly report: Report;
  readonly createdAt: string;
}

const isReport = (value: unknown): value is Report => isRecord(value) && Array.isArray(value["dimensions"]) && isRecord(value["overall"]);

export const readBaseline = async (root: string): Promise<Baseline | undefined> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(root, BASELINE_PATH), "utf8"));
    if (!isRecord(parsed) || !isReport(parsed["report"])) return undefined;
    const createdAt = parsed["createdAt"];
    return { report: parsed["report"], createdAt: typeof createdAt === "string" ? createdAt : "" };
  } catch {
    return undefined;
  }
};

export const writeBaseline = async (root: string, report: Report): Promise<string> => {
  const path = join(root, BASELINE_PATH);
  await mkdir(dirname(path), { recursive: true });
  const baseline: Baseline = { report, createdAt: new Date().toISOString() };
  await writeFile(path, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  return path;
};

/**
 * Tools whose version changed since the baseline (spec §17.3).
 *
 * Upgrading a linter adds rules and the score falls, which is not a regression. A tool that would
 * make every dependency bump look like decay is one nobody upgrades, so those dimensions are
 * reported as needing a fresh baseline rather than as having got worse.
 */
export const changedTools = (baseline: Report, current: Report): readonly string[] => {
  const before = baseline.toolVersions;
  const after = current.toolVersions;
  return Object.keys({ ...before, ...after }).filter((name) => before[name] !== after[name]);
};
