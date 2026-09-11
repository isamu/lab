import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Contributor, Finding, Probe, ProbeContext, ProbeResult } from "../plugin.ts";
import { resolveBin } from "../bin-resolve.ts";
import { isRecord } from "../package-json.ts";

/**
 * Copy-paste duplication (spec §13).
 *
 * Duplication is the shape generated code takes when the same requirement is met twice without
 * either author knowing about the other, so it reads on both the readability and the architecture
 * dimensions. jscpd is a token-level comparison and needs nothing installed in the target.
 */

const MIN_TOKENS = "50";
const TOP_CONTRIBUTORS = 5;
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

const relativeTo = (root: string, file: string): string => (file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file);

const contributorsOf = (root: string, clones: readonly Clone[]): readonly Contributor[] => {
  const byFile = new Map<string, number>();
  clones.forEach((clone) => {
    const file = relativeTo(root, clone.file);
    byFile.set(file, (byFile.get(file) ?? 0) + clone.lines);
  });
  return [...byFile.entries()]
    .map(([file, value]) => ({ file, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_CONTRIBUTORS);
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

const empty = (reason: string, started: number): ProbeResult => ({
  probe: "jscpd",
  status: { kind: "skipped", reason },
  metrics: [],
  findings: [],
  toolVersions: {},
  durationMs: Date.now() - started,
});

const run = async (ctx: ProbeContext): Promise<ProbeResult> => {
  const started = Date.now();
  const bin = resolveBin("jscpd", "jscpd");
  if (bin === undefined) return empty("jscpd is not installed alongside scoria", started);
  const out = join(tmpdir(), `scoria-jscpd-${String(process.pid)}-${String(Date.now())}`);
  const args = [ctx.root, "--silent", "--min-tokens", MIN_TOKENS, "--reporters", "json", "--output", out];
  const run_ = await ctx.exec(bin, args);
  const text = await ctx.readText(join(out, "jscpd-report.json"));
  const parsed = text === undefined ? undefined : parse(text);
  // jscpd writes no report when it finds nothing. That is zero duplication, not a failed run.
  const report = parsed ?? (run_.code === 0 ? { percentage: 0, clones: [] } : undefined);
  if (report === undefined) return empty("jscpd produced no readable report", started);
  {
    return {
      probe: "jscpd",
      status: { kind: "ok" },
      metrics: [
        {
          id: "jscpd.duplicated_lines_pct",
          value: report.percentage,
          unit: "pct",
          topContributors: contributorsOf(ctx.root, report.clones),
        },
        { id: "jscpd.clone_count", value: report.clones.length, unit: "count" },
      ],
      findings: report.clones.slice(0, MAX_FINDINGS).map((clone) => toFinding(ctx.root, clone)),
      toolVersions: { jscpd: (await ctx.exec(bin, ["--version"])).stdout.trim() },
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
