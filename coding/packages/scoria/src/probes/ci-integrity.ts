import type { Finding, Probe, ProbeContext, ProbeResult, ConfigFile } from "../plugin.ts";
import { workflowsOf } from "../config-files.ts";
import { relativeTo } from "./shared.ts";
import type { Gap } from "./config-integrity.ts";

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

const combinedText = (workflows: readonly ConfigFile[]): string => workflows.map((file) => file.text).join("\n");

const missingSteps = (text: string, typescript: boolean): readonly string[] => {
  const wanted = typescript ? EXPECTED_STEPS : EXPECTED_STEPS.filter((step) => step !== "typecheck");
  return wanted.filter((step) => !new RegExp(`\\b${step}\\b`).test(text));
};

const countMatches = (text: string, pattern: RegExp): number => [...text.matchAll(pattern)].length;

const WORKFLOW_ROOT = ".github/workflows";

/** Which workflow swallows a failure, so the finding lands on a line someone can open. */
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

const swallowingWorkflow = (workflows: readonly ConfigFile[]): ConfigFile | undefined =>
  workflows.find((file) => /continue-on-error:\s*true/.test(file.text) || /\|\|\s*true/.test(file.text)) ?? workflows[0];

const locatedCiGaps = (root: string, files: readonly ConfigFile[], typescript: boolean): readonly LocatedGap[] => {
  const workflows = workflowsOf(files);
  if (workflows.length === 0) {
    return [
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
    ];
  }
  const text = combinedText(workflows);
  const anyWorkflow = locate(root, workflows[0]?.path);
  const stepGaps = missingSteps(text, typescript).map((step) => ({
    file: anyWorkflow,
    gap: {
      id: `ci-step-${step}`,
      severity: "warning" as const,
      title: `CI does not run \`${step}\``,
      detail: `${workflows.length} ${workflows.length === 1 ? "workflow" : "workflows"} found, none mentioning ${step}.`,
      fixable: false,
    },
  }));
  const swallowed = countMatches(text, /continue-on-error:\s*true/g) + countMatches(text, /\|\|\s*true/g);
  const swallowGaps =
    swallowed === 0
      ? []
      : [
          {
            file: locate(root, swallowingWorkflow(workflows)?.path),
            gap: {
              id: "ci-swallowed-failures",
              severity: "error" as const,
              title: `${swallowed} ${swallowed === 1 ? "step swallows" : "steps swallow"} their failure`,
              detail: `\`continue-on-error: true\` or \`|| true\` makes a job green whatever it found (${swallowingWorkflow(workflows)?.path ?? WORKFLOW_ROOT}).`,
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
