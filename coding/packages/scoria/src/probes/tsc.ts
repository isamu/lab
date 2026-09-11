import type { Finding, Probe, ProbeContext, ProbeResult } from "../plugin.ts";
import { sourceSloc } from "../files.ts";
import { perKiloLines } from "../stats.ts";
import { resolveBinFrom } from "../bin-resolve.ts";
import { findConfig } from "../config-files.ts";

/**
 * Type errors, from the project's own TypeScript (spec §12.1).
 *
 * This is the one exception to scoria bringing its own tooling. A type check is only meaningful
 * against the project's tsconfig and its installed type definitions; running ours would check a
 * program that does not exist.
 *
 * It needs the target installed, so it is Tier 1: `skipped` where it is not, which the scoring
 * excludes rather than punishes (spec §18.1).
 */

const MAX_FINDINGS = 30;
const MARKER = "): error ";

interface TypeError {
  readonly file: string;
  readonly line: number;
  readonly code: string;
  readonly message: string;
}

/**
 * `src/a.ts(12,5): error TS2345: message`, split rather than matched.
 * A regex for this shape backtracks on every line that is not an error, and tsc prints many.
 */
const parseLine = (raw: string): TypeError | undefined => {
  const line = raw.trim();
  const marker = line.indexOf(MARKER);
  if (marker < 0) return undefined;
  const head = line.slice(0, marker);
  const tail = line.slice(marker + MARKER.length);
  const open = head.lastIndexOf("(");
  const colon = tail.indexOf(":");
  if (open < 0 || colon < 0) return undefined;
  return {
    file: head.slice(0, open),
    line: Number(head.slice(open + 1).split(",")[0]) || 1,
    code: tail.slice(0, colon),
    message: tail.slice(colon + 1).trim(),
  };
};

const parse = (output: string): readonly TypeError[] =>
  output.split("\n").flatMap((line) => {
    const error = parseLine(line);
    return error === undefined ? [] : [error];
  });

const toFinding = (error: TypeError): Finding => ({
  rule: `tsc/${error.code}`,
  severity: "error",
  file: error.file,
  line: error.line,
  message: error.message,
  probe: "tsc",
  dimension: "type-safety",
  tier: 1,
});

const empty = (reason: string, started: number): ProbeResult => ({
  probe: "tsc",
  status: { kind: "skipped", reason },
  metrics: [],
  findings: [],
  toolVersions: {},
  durationMs: Date.now() - started,
});

const run = async (ctx: ProbeContext): Promise<ProbeResult> => {
  const started = Date.now();
  const bin = resolveBinFrom(ctx.root, "typescript", "tsc");
  if (bin === undefined) return empty("the project has no installed typescript", started);
  const result = await ctx.exec(bin, ["--noEmit", "--pretty", "false"]);
  const errors = parse(`${result.stdout}\n${result.stderr}`);
  const sloc = sourceSloc(ctx.files);
  return {
    probe: "tsc",
    status: { kind: "ok" },
    metrics: [
      { id: "tsc.type_errors", value: errors.length, unit: "count" },
      { id: "tsc.type_errors_per_kloc", value: perKiloLines(errors.length, sloc), unit: "per_kloc" },
    ],
    findings: errors.slice(0, MAX_FINDINGS).map(toFinding),
    toolVersions: { typescript: (await ctx.exec(bin, ["--version"])).stdout.trim().replace("Version ", "") },
    durationMs: Date.now() - started,
  };
};

export const tsc: Probe = {
  kind: "probe",
  id: "tsc",
  apiVersion: 1,
  tier: 1,
  declares: ["tsc.type_errors", "tsc.type_errors_per_kloc"],
  detect: (ctx) =>
    Promise.resolve(findConfig(ctx.configFiles, "tsconfig.json") === undefined ? { kind: "skipped", reason: "no tsconfig.json" } : { kind: "ok" }),
  run,
};
