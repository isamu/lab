import type { Finding, Probe, ProbeContext, ProbeResult } from "../plugin.ts";
import { resolveBin } from "../bin-resolve.ts";
import { isRecord } from "../package-json.ts";
import { rankByFile, skippedResult } from "./shared.ts";

/**
 * Code and dependencies nothing reaches (spec §13.4).
 *
 * Unused exports and files are what a generated codebase accumulates: each addition was reachable
 * when it was written, and nothing removes it when the caller changes. knip resolves the import
 * graph, so it needs the target installed — Tier 1.
 */

const MAX_FINDINGS = 30;

interface Unused {
  readonly files: readonly string[];
  readonly exports: readonly { file: string; name: string }[];
  readonly dependencies: readonly string[];
}

/**
 * knip's JSON reporter emits one issue object per file, with named buckets inside it. A bucket
 * entry is either a bare string or `{ name }`, and which one varies by bucket: `files` uses the
 * object form. Reading only strings is why `unused_files` was zero across all 49 repositories of
 * the calibration corpus while knip itself reported plenty.
 */
const namesIn = (issue: Record<string, unknown>, bucket: string): readonly string[] => {
  const entries = issue[bucket];
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    if (typeof entry === "string") return [entry];
    const name = isRecord(entry) ? entry["name"] : undefined;
    return typeof name === "string" ? [name] : [];
  });
};

/** knip's reporter emits either a bare array of issues or an object wrapping one. */
const issuesIn = (parsed: unknown): unknown => {
  if (Array.isArray(parsed)) return parsed;
  return isRecord(parsed) ? parsed["issues"] : undefined;
};

const parse = (stdout: string): Unused | undefined => {
  try {
    const issues = issuesIn(JSON.parse(stdout));
    if (!Array.isArray(issues)) return undefined;
    const records = issues.filter(isRecord);
    return {
      files: records.flatMap((issue) => namesIn(issue, "files")),
      exports: records.flatMap((issue) => {
        const file = typeof issue["file"] === "string" ? issue["file"] : "";
        return namesIn(issue, "exports").map((name) => ({ file, name }));
      }),
      dependencies: records.flatMap((issue) => namesIn(issue, "dependencies")),
    };
  } catch {
    return undefined;
  }
};

const findingsOf = (unused: Unused): readonly Finding[] => [
  ...unused.files.map((file) => ({
    rule: "unused-file",
    severity: "warning" as const,
    file,
    line: 1,
    message: "nothing imports this file",
    probe: "knip",
    dimension: "architecture",
    tier: 1 as const,
  })),
  ...unused.exports.map((entry) => ({
    rule: "unused-export",
    severity: "warning" as const,
    file: entry.file,
    line: 1,
    message: `\`${entry.name}\` is exported but never imported`,
    probe: "knip",
    dimension: "architecture",
    tier: 1 as const,
  })),
];

const run = async (ctx: ProbeContext): Promise<ProbeResult> => {
  const started = Date.now();
  const bin = resolveBin("knip", "knip");
  if (bin === undefined) return skippedResult("knip", "knip is not installed alongside scoria", started);
  const result = await ctx.execNode(bin, ["--reporter", "json", "--no-progress", "--no-exit-code"]);
  const unused = parse(result.stdout);
  if (unused === undefined) return skippedResult("knip", "knip produced no readable report", started);
  return {
    probe: "knip",
    status: { kind: "ok" },
    metrics: [
      { id: "knip.unused_files", value: unused.files.length, unit: "count" },
      {
        id: "knip.unused_exports",
        value: unused.exports.length,
        unit: "count",
        topContributors: rankByFile(unused.exports.map((entry) => ({ file: entry.file, weight: 1 }))),
      },
      { id: "knip.unused_dependencies", value: unused.dependencies.length, unit: "count" },
    ],
    findings: findingsOf(unused).slice(0, MAX_FINDINGS),
    toolVersions: { knip: (await ctx.execNode(bin, ["--version"])).stdout.trim() },
    durationMs: Date.now() - started,
  };
};

export const knip: Probe = {
  kind: "probe",
  id: "knip",
  apiVersion: 1,
  tier: 1,
  declares: ["knip.unused_files", "knip.unused_exports", "knip.unused_dependencies"],
  detect: (ctx) => {
    if (!ctx.files.some((file) => file.kind === "source")) {
      return Promise.resolve({ kind: "absent", reason: "no source files" });
    }
    // Without node_modules knip resolves nothing and reports nothing, which reads as a clean repo.
    return Promise.resolve(ctx.project.installed ? { kind: "ok" } : { kind: "skipped", reason: "the project's dependencies are not installed" });
  },
  run,
};
