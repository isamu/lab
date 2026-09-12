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
 * Two formats are read. Istanbul's `json-summary`, which Vitest, Jest and nyc can all emit — and
 * lcov, because most of them emit that by default while `json-summary` has to be asked for, and
 * because Node's own test runner writes it with `--test-reporter=lcov`. Across 49 repositories
 * measured for docs/calibration.md, not one carried a coverage report of any kind: the output is
 * gitignored everywhere, so this fires only where CI runs the tests before scoria.
 */

const JSON_REPORTS = ["coverage/coverage-summary.json", "coverage/coverage-final.json"];
const LCOV_REPORTS = ["coverage/lcov.info", "lcov.info"];

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

/**
 * lcov counts rather than percentages: `LF`/`LH` lines found and hit, `FNF`/`FNH` functions,
 * `BRF`/`BRH` branches, once per file. The totals are the sums, so a file with no branches at all
 * contributes nothing rather than a hundred per cent of nothing.
 */
const LCOV_FIELDS = ["LF", "LH", "FNF", "FNH", "BRF", "BRH"] as const;

type LcovTotals = Record<(typeof LCOV_FIELDS)[number], number>;

const share = (hit: number, found: number): number => (found === 0 ? 0 : Number(((hit / found) * 100).toFixed(2)));

const parseLcov = (text: string): Percentages | undefined => {
  const totals: LcovTotals = { LF: 0, LH: 0, FNF: 0, FNH: 0, BRF: 0, BRH: 0 };
  const lines = text.split("\n");
  lines.forEach((line) => {
    const [field, value] = line.trim().split(":");
    const known = LCOV_FIELDS.find((candidate) => candidate === field);
    if (known === undefined) return;
    const count = Number(value);
    if (Number.isFinite(count)) totals[known] += count;
  });
  if (totals.LF === 0) return undefined;
  return { lines: share(totals.LH, totals.LF), branches: share(totals.BRH, totals.BRF), functions: share(totals.FNH, totals.FNF) };
};

const firstOf = async (ctx: ProbeContext, paths: readonly string[], read: (text: string) => Percentages | undefined): Promise<Percentages | undefined> => {
  const texts = await Promise.all(paths.map((path) => ctx.readText(join(ctx.root, path))));
  return texts.flatMap((text) => (text === undefined ? [] : [read(text)])).find((found) => found !== undefined);
};

const findReport = async (ctx: ProbeContext): Promise<Percentages | undefined> =>
  (await firstOf(ctx, JSON_REPORTS, parse)) ?? (await firstOf(ctx, LCOV_REPORTS, parseLcov));

const run = async (ctx: ProbeContext): Promise<ProbeResult> => {
  const started = Date.now();
  const percentages = await findReport(ctx);
  if (percentages === undefined) {
    return skippedResult("coverage", "no coverage report in coverage/; scoria does not run the project's tests", started);
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
