import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import type { Exec, Probe, ProbeContext, ProbeResult, SourceFile } from "./plugin.ts";
import type { Rubric } from "./rubric.ts";
import { collectFiles } from "./files.ts";
import { assertMetricsAreDeclared, loadRubrics } from "./rubric-load.ts";
import { buildReport, type Report } from "./report.ts";
import { classify } from "@scoria/stack-ts";
import { suppressionScan } from "./probes/suppression-scan.ts";
import { fileShape } from "./probes/file-shape.ts";

const EXEC_TIMEOUT_MS = 120_000;
const execFileAsync = promisify(execFile);

export const PROBES: readonly Probe[] = [suppressionScan, fileShape];

/**
 * 外部コマンドの起動を core が持つ。probe が直接 spawn すると、版数の記録も
 * タイムアウトも core を通らなくなる（spec §8, §19.3）。
 */
const makeExec = (cwd: string): Exec => {
  return async (command, args) => {
    try {
      const { stdout, stderr } = await execFileAsync(command, [...args], { cwd, timeout: EXEC_TIMEOUT_MS });
      return { stdout, stderr, code: 0 };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return { stdout: "", stderr: message, code: 1 };
    }
  };
};

const skippedResult = (probe: Probe, reason: string): ProbeResult => ({
  probe: probe.id,
  status: { kind: "skipped", reason },
  metrics: [],
  findings: [],
  toolVersions: {},
  durationMs: 0,
});

const runProbe = async (probe: Probe, ctx: ProbeContext): Promise<ProbeResult> => {
  const status = await probe.detect(ctx);
  if (status.kind === "ok") return probe.run(ctx);
  if (status.kind === "absent") return { ...skippedResult(probe, status.reason), status };
  return skippedResult(probe, status.reason);
};

const rubricDirectory = (): string => join(dirname(fileURLToPath(import.meta.url)), "..", "rubrics");

const declaredMetrics = (probes: readonly Probe[]): ReadonlySet<string> => new Set(probes.flatMap((p) => p.declares));

export interface Assay {
  readonly report: Report;
  readonly files: readonly SourceFile[];
  readonly rubrics: readonly Rubric[];
}

export const assay = async (target: string, probes: readonly Probe[] = PROBES): Promise<Assay> => {
  const root = resolve(target);
  const rubrics = await loadRubrics(rubricDirectory());
  assertMetricsAreDeclared(rubrics, declaredMetrics(probes));
  const files = await collectFiles(root, classify);
  const ctx: ProbeContext = { root, files, exec: makeExec(root) };
  const results = await Promise.all(probes.map((probe) => runProbe(probe, ctx)));
  return { report: buildReport(root, files, results, rubrics), files, rubrics };
};
