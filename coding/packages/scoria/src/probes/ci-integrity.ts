import type { Finding, Probe, ProbeContext, ProbeResult, ConfigFile } from "../plugin.ts";
import { workflowsOf } from "../config-files.ts";
import type { Gap } from "./config-integrity.ts";

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

export const ciGaps = (files: readonly ConfigFile[], typescript: boolean): readonly Gap[] => {
  const workflows = workflowsOf(files);
  if (workflows.length === 0) {
    return [
      {
        id: "ci-missing",
        severity: "error",
        title: "No CI workflow",
        detail: "Nothing runs the gates on a pull request, so nothing stops a regression from merging.",
        fixable: false,
      },
    ];
  }
  const text = combinedText(workflows);
  const stepGaps = missingSteps(text, typescript).map((step) => ({
    id: `ci-step-${step}`,
    severity: "warning" as const,
    title: `CI does not run \`${step}\``,
    detail: `${workflows.length} ${workflows.length === 1 ? "workflow" : "workflows"} found, none mentioning ${step}.`,
    fixable: false,
  }));
  const swallowed = countMatches(text, /continue-on-error:\s*true/g) + countMatches(text, /\|\|\s*true/g);
  const swallowGaps =
    swallowed === 0
      ? []
      : [
          {
            id: "ci-swallowed-failures",
            severity: "error" as const,
            title: `${swallowed} ${swallowed === 1 ? "step swallows" : "steps swallow"} their failure`,
            detail: "`continue-on-error: true` or `|| true` makes a job green whatever it found.",
            fixable: false,
          },
        ];
  return [...stepGaps, ...swallowGaps];
};

const toFinding = (gap: Gap): Finding => ({
  rule: gap.id,
  severity: gap.severity,
  file: ".github/workflows",
  line: 1,
  message: gap.title,
  probe: "ci-integrity",
  dimension: "integrity",
  tier: 0,
});

const assess = (ctx: ProbeContext): ProbeResult => {
  const started = Date.now();
  const gaps = ciGaps(ctx.configFiles, ctx.project.typescript);
  return {
    probe: "ci-integrity",
    status: { kind: "ok" },
    metrics: [
      { id: "ci-integrity.gap_ratio", value: Number((gaps.length / CHECKS).toFixed(4)), unit: "ratio" },
      { id: "ci-integrity.gap_count", value: gaps.length, unit: "count" },
      { id: "ci-integrity.workflow_count", value: workflowsOf(ctx.configFiles).length, unit: "count" },
    ],
    findings: gaps.map(toFinding),
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
