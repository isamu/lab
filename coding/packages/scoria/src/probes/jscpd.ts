import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Finding, Probe, ProbeContext, ProbeResult } from "../plugin.ts";
import { resolveBin } from "../bin-resolve.ts";
import { isRecord } from "../package-json.ts";
import { rankByFile, relativeTo, skippedResult } from "./shared.ts";

/**
 * Copy-paste duplication (spec §13).
 *
 * Duplication is the shape generated code takes when the same requirement is met twice without
 * either author knowing about the other, so it reads on both the readability and the architecture
 * dimensions. jscpd is a token-level comparison and needs nothing installed in the target.
 */

const MIN_TOKENS = "50";

/**
 * Duplication is about code, so JSON, Markdown and text are out of scope.
 *
 * scoria's own artifacts are excluded for a sharper reason: `.scoria/baseline.json` is a record of
 * the previous run, and counting it means recording a baseline changes the next measurement. A
 * tool that perturbs what it measures cannot produce a time series.
 */
const FORMATS = "typescript,tsx,javascript,jsx,vue";
const IGNORED = ["**/.scoria/**", "**/node_modules/**", "**/dist/**", "**/lib/**", "**/build/**"].join(",");
const MAX_FINDINGS = 20;

interface Clone {
  readonly file: string;
  readonly line: number;
  readonly lines: number;
}

const asNumber = (value: unknown): number => (typeof value === "number" ? value : 0);

const cloneOf = (raw: unknown): Clone | undefined => {
  if (!isRecord(raw)) return undefined;
  const first = raw["firstFile"];
  if (!isRecord(first)) return undefined;
  const name = first["name"];
  return typeof name === "string" ? { file: name, line: Math.max(1, asNumber(first["start"])), lines: asNumber(raw["lines"]) } : undefined;
};

interface Report {
  readonly percentage: number;
  readonly clones: readonly Clone[];
}

const parse = (text: string): Report | undefined => {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) return undefined;
    const statistics = isRecord(parsed["statistics"]) ? parsed["statistics"] : {};
    const total = isRecord(statistics["total"]) ? statistics["total"] : {};
    const duplicates = parsed["duplicates"];
    return {
      percentage: asNumber(total["percentage"]),
      clones: Array.isArray(duplicates)
        ? duplicates.flatMap((entry) => {
            const clone = cloneOf(entry);
            return clone === undefined ? [] : [clone];
          })
        : [],
    };
  } catch {
    return undefined;
  }
};

const toFinding = (root: string, clone: Clone): Finding => ({
  rule: "duplicated-block",
  severity: "warning",
  file: relativeTo(root, clone.file),
  line: clone.line,
  message: `${clone.lines} duplicated lines`,
  probe: "jscpd",
  dimension: "readability",
  tier: 0,
});

const run = async (ctx: ProbeContext): Promise<ProbeResult> => {
  const started = Date.now();
  const bin = resolveBin("jscpd", "jscpd");
  if (bin === undefined) return skippedResult("jscpd", "jscpd is not installed alongside scoria", started);
  const out = join(tmpdir(), `scoria-jscpd-${String(process.pid)}-${String(Date.now())}`);
  const args = [ctx.root, "--silent", "--min-tokens", MIN_TOKENS, "--format", FORMATS, "--ignore", IGNORED, "--reporters", "json", "--output", out];
  const execution = await ctx.execNode(bin, args);
  const text = await ctx.readText(join(out, "jscpd-report.json"));
  const parsed = text === undefined ? undefined : parse(text);
  // jscpd writes no report when it finds nothing. That is zero duplication, not a failed run.
  const report = parsed ?? (execution.code === 0 ? { percentage: 0, clones: [] } : undefined);
  if (report === undefined) return skippedResult("jscpd", "jscpd produced no readable report", started);
  {
    return {
      probe: "jscpd",
      status: { kind: "ok" },
      metrics: [
        {
          id: "jscpd.duplicated_lines_pct",
          value: report.percentage,
          unit: "pct",
          topContributors: rankByFile(report.clones.map((clone) => ({ file: relativeTo(ctx.root, clone.file), weight: clone.lines }))),
        },
        { id: "jscpd.clone_count", value: report.clones.length, unit: "count" },
      ],
      findings: report.clones.slice(0, MAX_FINDINGS).map((clone) => toFinding(ctx.root, clone)),
      toolVersions: { jscpd: (await ctx.execNode(bin, ["--version"])).stdout.trim() },
      durationMs: Date.now() - started,
    };
  }
};

export const jscpd: Probe = {
  kind: "probe",
  id: "jscpd",
  apiVersion: 1,
  tier: 0,
  declares: ["jscpd.duplicated_lines_pct", "jscpd.clone_count"],
  detect: (ctx) => Promise.resolve(ctx.files.some((file) => file.kind === "source") ? { kind: "ok" } : { kind: "absent", reason: "no source files" }),
  run,
};
