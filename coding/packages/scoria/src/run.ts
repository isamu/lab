import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import type { Exec, Probe, ProbeContext, ProbeResult, SourceFile, StackAdapter } from "./plugin.ts";
import type { Rubric } from "./rubric.ts";
import type { LoadedConfig } from "./config.ts";
import { loadConfig } from "./config.ts";
import { collectFiles } from "./files.ts";
import { collectConfigFiles } from "./config-files.ts";
import { assertMetricsAreDeclared, loadRubrics } from "./rubric-load.ts";
import { buildReport, type Report } from "./report.ts";
import { ALL_STACKS, stackById, stackTs } from "./stacks/index.ts";
import { isTypeScriptProject } from "./stacks/ts.ts";
import { readPackageJson } from "./package-json.ts";
import { suppressionScan } from "./probes/suppression-scan.ts";
import { fileShape } from "./probes/file-shape.ts";
import { sourceMix } from "./probes/source-mix.ts";
import { configIntegrity } from "./probes/config-integrity.ts";
import { ciIntegrity } from "./probes/ci-integrity.ts";

const EXEC_TIMEOUT_MS = 120_000;
const execFileAsync = promisify(execFile);

export const PROBES: readonly Probe[] = [suppressionScan, fileShape, sourceMix, configIntegrity, ciIntegrity];

/**
 * The core owns process spawning. A probe that spawns directly takes both version recording and
 * timeouts out of the core's hands (spec §8, §19.3).
 */
const makeExec =
  (cwd: string): Exec =>
  async (command, args) => {
    try {
      const { stdout, stderr } = await execFileAsync(command, [...args], { cwd, timeout: EXEC_TIMEOUT_MS });
      return { stdout, stderr, code: 0 };
    } catch (cause) {
      return { stdout: "", stderr: cause instanceof Error ? cause.message : String(cause), code: 1 };
    }
  };

const emptyResult = (probe: Probe, reason: string): ProbeResult => ({
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
  return { ...emptyResult(probe, status.reason), status };
};

const rubricDirectory = (): string => join(dirname(fileURLToPath(import.meta.url)), "..", "rubrics");

/** Keeps ALL_STACKS order: composeClassify takes the first match, so vue must precede ts. */
const resolveStacks = (ids: readonly string[]): readonly StackAdapter[] => {
  const chosen = ALL_STACKS.filter((stack) => ids.includes(stack.id));
  return chosen.some((stack) => stack.id === "ts") ? chosen : [...chosen, stackTs];
};

export interface Assay {
  readonly report: Report;
  readonly files: readonly SourceFile[];
  readonly rubrics: readonly Rubric[];
  readonly loaded: LoadedConfig;
}

export const assay = async (target: string, probes: readonly Probe[] = PROBES): Promise<Assay> => {
  const root = resolve(target);
  const loaded = await loadConfig(root);
  const rubrics = await loadRubrics(rubricDirectory());
  assertMetricsAreDeclared(rubrics, new Set(probes.flatMap((probe) => probe.declares)));
  const files = await collectFiles(root, resolveStacks(loaded.config.stacks));
  const configFiles = await collectConfigFiles(root);
  const project = { typescript: isTypeScriptProject(await readPackageJson(root)), stacks: loaded.config.stacks };
  const ctx: ProbeContext = { root, files, configFiles, project, exec: makeExec(root) };
  const results = await Promise.all(probes.map((probe) => runProbe(probe, ctx)));
  return {
    report: buildReport(root, files, results, rubrics, { profile: loaded.config.profile, stacks: loaded.config.stacks }),
    files,
    rubrics,
    loaded,
  };
};

export { stackById };
