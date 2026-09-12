import { join } from "node:path";
import type { Probe, ProbeContext, ProbeResult } from "../plugin.ts";
import { isRecord } from "../package-json.ts";
import { skippedResult } from "./shared.ts";

/**
 * Line, branch and function coverage, read from a report the project already produced.
 *
 * scoria does not run the project's tests. A suite can take minutes, touch a database, need
 * credentials, or leave state behind — a quality tool that triggers all that as a side effect of
 * being asked for a number is not one anyone will run twice. If CI produces coverage, it is on
 * disk; if not, this reports skipped and `test-presence` still answers the blunter question.
 *
 * Istanbul's `json-summary` reporter is the format read here, because Vitest, Jest and nyc all
 * emit it.
 */

const REPORT_PATHS = ["coverage/coverage-summary.json", "coverage/coverage-final.json"];

interface Percentages {
  readonly lines: number;
  readonly branches: number;
  readonly functions: number;
}

const pctOf = (raw: unknown): number => {
  if (!isRecord(raw)) return 0;
  const pct = raw["pct"];
  return typeof pct === "number" ? pct : 0;
};

const parse = (text: string): Percentages | undefined => {
  try {
    const parsed: unknown = JSON.parse(text);
    const total = isRecord(parsed) ? parsed["total"] : undefined;
    if (!isRecord(total)) return undefined;
    return {
      lines: pctOf(total["lines"]),
      branches: pctOf(total["branches"]),
      functions: pctOf(total["functions"]),
    };
  } catch {
    return undefined;
  }
};

const findReport = async (ctx: ProbeContext): Promise<Percentages | undefined> => {
  const texts = await Promise.all(REPORT_PATHS.map((path) => ctx.readText(join(ctx.root, path))));
  return texts.flatMap((text) => (text === undefined ? [] : [parse(text)])).find((found) => found !== undefined);
};

const run = async (ctx: ProbeContext): Promise<ProbeResult> => {
  const started = Date.now();
  const percentages = await findReport(ctx);
  if (percentages === undefined) {
    return skippedResult("coverage", "no coverage report; scoria does not run the project's tests", started);
  }
  return {
    probe: "coverage",
    status: { kind: "ok" },
    metrics: [
      { id: "coverage.line_pct", value: percentages.lines, unit: "pct" },
      { id: "coverage.branch_pct", value: percentages.branches, unit: "pct" },
      { id: "coverage.function_pct", value: percentages.functions, unit: "pct" },
    ],
    findings: [],
    toolVersions: {},
    durationMs: Date.now() - started,
  };
};

export const coverage: Probe = {
  kind: "probe",
  id: "coverage",
  apiVersion: 1,
  tier: 1,
  declares: ["coverage.line_pct", "coverage.branch_pct", "coverage.function_pct"],
  detect: () => Promise.resolve({ kind: "ok" }),
  run,
};
