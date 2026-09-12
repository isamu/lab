import type { Probe, ProbeContext, ProbeResult } from "../plugin.ts";
import { isRecord } from "../package-json.ts";
import { skippedResult } from "./shared.ts";

/**
 * Known vulnerabilities in the dependency tree.
 *
 * The package manager already knows this and the project already has the lockfile, so scoria only
 * has to ask and normalise. Which tool to ask is decided by the lockfile: `npm audit` cannot read
 * a yarn.lock and says so rather than reporting zero.
 *
 * It needs the network. Offline it reports skipped, which the scoring excludes rather than reads
 * as a clean tree (spec §18.1).
 */

interface Counts {
  readonly critical: number;
  readonly high: number;
  readonly moderate: number;
  readonly low: number;
}

const EMPTY: Counts = { critical: 0, high: 0, moderate: 0, low: 0 };

const asCount = (value: unknown): number => (typeof value === "number" ? value : 0);

const countsFrom = (raw: unknown): Counts | undefined =>
  isRecord(raw)
    ? {
        critical: asCount(raw["critical"]),
        high: asCount(raw["high"]),
        moderate: asCount(raw["moderate"]),
        low: asCount(raw["low"]),
      }
    : undefined;

/** yarn emits line-delimited JSON and puts the totals in an `auditSummary` record. */
const parseYarn = (stdout: string): Counts | undefined => {
  const summaries = stdout.split("\n").flatMap((line) => {
    try {
      const parsed: unknown = JSON.parse(line);
      if (!isRecord(parsed) || parsed["type"] !== "auditSummary") return [];
      const data = parsed["data"];
      const counts = isRecord(data) ? countsFrom(data["vulnerabilities"]) : undefined;
      return counts === undefined ? [] : [counts];
    } catch {
      return [];
    }
  });
  return summaries.at(-1);
};

/** npm emits one object with the totals under `metadata.vulnerabilities`. */
const parseNpm = (stdout: string): Counts | undefined => {
  try {
    const parsed: unknown = JSON.parse(stdout);
    const metadata = isRecord(parsed) ? parsed["metadata"] : undefined;
    return isRecord(metadata) ? countsFrom(metadata["vulnerabilities"]) : undefined;
  } catch {
    return undefined;
  }
};

/** On Windows a package manager is a .cmd shim, and execFile will not find it without the suffix. */
const commandFor = (manager: string): string => (process.platform === "win32" ? `${manager}.cmd` : manager);

interface Plan {
  readonly manager: string;
  readonly parse: (stdout: string) => Counts | undefined;
}

const planFor = (ctx: ProbeContext): Plan | undefined => {
  if (ctx.project.packageManager === "yarn") return { manager: "yarn", parse: parseYarn };
  return ctx.project.packageManager === "npm" ? { manager: "npm", parse: parseNpm } : undefined;
};

const run = async (ctx: ProbeContext): Promise<ProbeResult> => {
  const started = Date.now();
  const plan = planFor(ctx);
  if (plan === undefined) return skippedResult("audit", "no lockfile to audit", started);
  const result = await ctx.exec(commandFor(plan.manager), ["audit", "--json"]);
  const counts = plan.parse(result.stdout) ?? (result.code === 0 ? EMPTY : undefined);
  if (counts === undefined) {
    return skippedResult("audit", `${plan.manager} audit produced no readable report`, started);
  }
  return {
    probe: "audit",
    status: { kind: "ok" },
    metrics: [
      { id: "audit.critical", value: counts.critical, unit: "count" },
      { id: "audit.high", value: counts.high, unit: "count" },
      { id: "audit.moderate", value: counts.moderate, unit: "count" },
      { id: "audit.low", value: counts.low, unit: "count" },
    ],
    findings: [],
    toolVersions: { [plan.manager]: (await ctx.exec(commandFor(plan.manager), ["--version"])).stdout.trim() },
    durationMs: Date.now() - started,
  };
};

export const audit: Probe = {
  kind: "probe",
  id: "audit",
  apiVersion: 1,
  tier: 1,
  declares: ["audit.critical", "audit.high", "audit.moderate", "audit.low"],
  detect: (ctx) => Promise.resolve(planFor(ctx) === undefined ? { kind: "skipped", reason: "no lockfile to audit" } : { kind: "ok" }),
  run,
};
