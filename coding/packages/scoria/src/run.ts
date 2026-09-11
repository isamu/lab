import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import type { Exec, ExecNode, ExecResult, Probe, ProbeContext, ProbeResult, ReadText, SourceFile, StackAdapter } from "./plugin.ts";
import type { Rubric } from "./rubric.ts";
import type { LoadedConfig } from "./config.ts";
import { loadConfig } from "./config.ts";
import { collectFiles } from "./files.ts";
import { collectConfigFiles } from "./config-files.ts";
import { assertMetricsAreDeclared, loadRubrics } from "./rubric-load.ts";
import { buildReport, type Report } from "./report.ts";
import { ALL_STACKS, stackTs } from "./stacks/index.ts";
import { isTypeScriptProject } from "./stacks/ts.ts";
import { isRecord, readPackageJson } from "./package-json.ts";
import { suppressionScan } from "./probes/suppression-scan.ts";
import { fileShape } from "./probes/file-shape.ts";
import { sourceMix } from "./probes/source-mix.ts";
import { configIntegrity } from "./probes/config-integrity.ts";
import { ciIntegrity } from "./probes/ci-integrity.ts";
import { oxlint } from "./probes/oxlint.ts";
import { jscpd } from "./probes/jscpd.ts";
import { tsc } from "./probes/tsc.ts";
import { knip } from "./probes/knip.ts";

const EXEC_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
const execFileAsync = promisify(execFile);

export const PROBES: readonly Probe[] = [suppressionScan, fileShape, sourceMix, configIntegrity, ciIntegrity, oxlint, jscpd, tsc, knip];

/**
 * The core owns process spawning. A probe that spawns directly takes both version recording and
 * timeouts out of the core's hands (spec §8, §19.3).
 */
const asText = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * A linter exits non-zero precisely when it has something to report, and execFile turns that into
 * a rejection. Discarding the output on rejection loses the findings of every tool worth running.
 */
const failedResult = (cause: unknown): ExecResult => {
  const detail = isRecord(cause) ? cause : {};
  return {
    stdout: asText(detail["stdout"]),
    stderr: asText(detail["stderr"]) || (cause instanceof Error ? cause.message : String(cause)),
    code: typeof detail["code"] === "number" ? detail["code"] : 1,
  };
};

const isInstalled = (root: string): Promise<boolean> =>
  access(join(root, "node_modules")).then(
    () => true,
    () => false,
  );

const makeExecNode =
  (exec: Exec): ExecNode =>
  (script, args) =>
    exec(process.execPath, [script, ...args]);

const readText: ReadText = (path) =>
  readFile(path, "utf8").then(
    (text) => text,
    () => undefined,
  );

const makeExec =
  (cwd: string): Exec =>
  async (command, args) => {
    try {
      const { stdout, stderr } = await execFileAsync(command, [...args], {
        cwd,
        timeout: EXEC_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
      });
      return { stdout, stderr, code: 0 };
    } catch (cause) {
      return failedResult(cause);
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
  const project = {
    typescript: isTypeScriptProject(await readPackageJson(root)),
    installed: await isInstalled(root),
    stacks: loaded.config.stacks,
  };
  const exec = makeExec(root);
  const ctx: ProbeContext = { root, files, configFiles, project, exec, execNode: makeExecNode(exec), readText };
  const results = await Promise.all(probes.map((probe) => runProbe(probe, ctx)));
  return {
    report: buildReport(root, files, results, rubrics, { profile: loaded.config.profile, stacks: loaded.config.stacks }, probes),
    files,
    rubrics,
    loaded,
  };
};
