import type { Finding, Probe, ProbeContext, ProbeResult, ConfigFile } from "../plugin.ts";
import { workflowsOf } from "../config-files.ts";
import { relativeTo } from "./shared.ts";
import type { Gap } from "./config-integrity.ts";
import { commandsIn, swallowedFailures } from "./swallow.ts";

/** A gap plus the file it was found in, so a finding points at something that exists. */
interface LocatedGap {
  readonly gap: Gap;
  readonly file: string;
}

/**
 * Whether CI actually runs the gates the project defines.
 *
 * A `lint` script nobody runs enforces nothing, and `continue-on-error: true` turns a red job into
 * decoration. Both make every other measurement read better than the repository deserves.
 */

const EXPECTED_STEPS = ["lint", "typecheck", "build", "test"];
const CHECKS = 6;

/**
 * A gate counts as run only if some step runs it. Searching the whole file for the word instead
 * counted a job named "test", a comment mentioning lint, or an action input that happened to
 * contain the word — reporting CI as complete when nothing executes the project's gates.
 */
const missingSteps = (workflows: readonly ConfigFile[], typescript: boolean): readonly string[] => {
  const wanted = typescript ? EXPECTED_STEPS : EXPECTED_STEPS.filter((step) => step !== "typecheck");
  const commands = commandsIn(workflows).join("\n");
  return wanted.filter((step) => !new RegExp(`\\b${step}\\b`).test(commands));
};

const WORKFLOW_ROOT = ".github/workflows";

/**
 * A finding has to point at a file inside the tree being measured, because that is what a SARIF
 * upload matches against. Workflows live at the repository root, which is above the measured
 * directory in a monorepo — there the location falls back to package.json, and the message carries
 * the workflow's name instead.
 */
const locate = (root: string, workflow: string | undefined): string => {
  if (workflow === undefined) return "package.json";
  const inside = relativeTo(root, workflow);
  return inside.startsWith("..") || inside === workflow ? "package.json" : inside;
};

/**
 * No workflow is not one gap. Every gate is missing, and counting it as one left a repository with
 * no CI at all scoring a gap ratio of 0.17 — better than one that has CI and is missing four of
 * six checks.
 */
const noWorkflowGaps = (typescript: boolean): readonly LocatedGap[] => [
  {
    file: "package.json",
    gap: {
      id: "ci-missing",
      severity: "error",
      title: "No CI workflow",
      detail: "Nothing runs the gates on a pull request, so nothing stops a regression from merging.",
      fixable: false,
    },
  },
  ...missingSteps([], typescript).map((step) => ({
    file: "package.json",
    gap: {
      id: `ci-step-${step}`,
      severity: "warning" as const,
      title: `CI does not run \`${step}\``,
      detail: "There is no workflow at all.",
      fixable: false,
    },
  })),
];

const locatedCiGaps = (root: string, files: readonly ConfigFile[], typescript: boolean): readonly LocatedGap[] => {
  const workflows = workflowsOf(files);
  if (workflows.length === 0) return noWorkflowGaps(typescript);
  const anyWorkflow = locate(root, workflows[0]?.path);
  const stepGaps = missingSteps(workflows, typescript).map((step) => ({
    file: anyWorkflow,
    gap: {
      id: `ci-step-${step}`,
      severity: "warning" as const,
      title: `CI does not run \`${step}\``,
      detail: `${workflows.length} ${workflows.length === 1 ? "workflow" : "workflows"} found, none mentioning ${step}.`,
      fixable: false,
    },
  }));
  const swallowed = swallowedFailures(workflows);
  const swallowGaps =
    swallowed.count === 0
      ? []
      : [
          {
            file: locate(root, swallowed.file ?? workflows[0]?.path),
            gap: {
              id: "ci-swallowed-failures",
              severity: "error" as const,
              title: `${swallowed.count} ${swallowed.count === 1 ? "step swallows" : "steps swallow"} their failure`,
              detail: `\`continue-on-error: true\`, or \`|| true\` with nothing judging what it captured, makes a job green whatever it found (${swallowed.file ?? WORKFLOW_ROOT}).`,
              fixable: false,
            },
          },
        ];
  return [...stepGaps, ...swallowGaps];
};

export const ciGaps = (root: string, files: readonly ConfigFile[], typescript: boolean): readonly Gap[] =>
  locatedCiGaps(root, files, typescript).map((located) => located.gap);

const toFinding = (located: LocatedGap): Finding => ({
  rule: located.gap.id,
  severity: located.gap.severity,
  file: located.file,
  line: 1,
  message: located.gap.title,
  probe: "ci-integrity",
  dimension: "integrity",
  tier: 0,
});

const assess = (ctx: ProbeContext): ProbeResult => {
  const started = Date.now();
  const located = locatedCiGaps(ctx.root, ctx.configFiles, ctx.project.typescript);
  const gaps = located.map((entry) => entry.gap);
  return {
    probe: "ci-integrity",
    status: { kind: "ok" },
    metrics: [
      { id: "ci-integrity.gap_ratio", value: Number((gaps.length / CHECKS).toFixed(4)), unit: "ratio" },
      { id: "ci-integrity.gap_count", value: gaps.length, unit: "count" },
      { id: "ci-integrity.workflow_count", value: workflowsOf(ctx.configFiles).length, unit: "count" },
    ],
    findings: located.map(toFinding),
    toolVersions: {},
    durationMs: Date.now() - started,
  };
};

export const ciIntegrity: Probe = {
  kind: "probe",
  id: "ci-integrity",
  apiVersion: 1,
  tier: 0,
  declares: ["ci-integrity.gap_ratio", "ci-integrity.gap_count", "ci-integrity.workflow_count"],
  detect: () => Promise.resolve({ kind: "ok" }),
  run: (ctx) => Promise.resolve(assess(ctx)),
};
