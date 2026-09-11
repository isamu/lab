import type { Finding, Probe, ProbeContext, ProbeResult, SourceFile } from "../plugin.ts";
import { slocOf } from "../files.ts";
import { isUntypedSource } from "../stacks/ts.ts";

/**
 * Counts the .js / .jsx left in a TypeScript project.
 *
 * A file that stays .js skips the type checker at file granularity. The effect is the same as
 * writing `@ts-nocheck`, except nothing in the code records that it happened.
 *
 * Projects without TypeScript are not warned. Telling a JavaScript project to adopt TypeScript
 * is not this probe's job.
 */

const TOP_CONTRIBUTORS = 5;

const ratio = (part: number, whole: number): number => (whole === 0 ? 0 : Number((part / whole).toFixed(4)));

const toFinding = (file: SourceFile): Finding => ({
  rule: "untyped-source",
  severity: "warning",
  file: file.path,
  line: 1,
  message: "not type-checked; rename to .ts / .tsx",
  probe: "source-mix",
  dimension: "type-safety",
  tier: 0,
});

const assess = (ctx: ProbeContext): ProbeResult => {
  const started = Date.now();
  const sources = ctx.files.filter((file) => file.kind === "source");
  const untyped = sources.filter((file) => isUntypedSource(file.path));
  const untypedSloc = untyped.reduce((sum, file) => sum + slocOf(file), 0);
  const totalSloc = sources.reduce((sum, file) => sum + slocOf(file), 0);
  return {
    probe: "source-mix",
    status: { kind: "ok" },
    metrics: [
      {
        id: "source-mix.untyped_file_ratio",
        value: ratio(untyped.length, sources.length),
        unit: "ratio",
        topContributors: untyped
          .map((file) => ({ file: file.path, value: slocOf(file) }))
          .toSorted((a, b) => b.value - a.value)
          .slice(0, TOP_CONTRIBUTORS),
      },
      { id: "source-mix.untyped_sloc_ratio", value: ratio(untypedSloc, totalSloc), unit: "ratio" },
      { id: "source-mix.untyped_file_count", value: untyped.length, unit: "count" },
      { id: "source-mix.typed_file_count", value: sources.length - untyped.length, unit: "count" },
    ],
    findings: untyped.map(toFinding),
    toolVersions: {},
    durationMs: Date.now() - started,
  };
};

export const sourceMix: Probe = {
  kind: "probe",
  id: "source-mix",
  apiVersion: 1,
  tier: 0,
  declares: ["source-mix.untyped_file_ratio", "source-mix.untyped_sloc_ratio", "source-mix.untyped_file_count", "source-mix.typed_file_count"],
  detect: (ctx) =>
    Promise.resolve(
      ctx.project.typescript ? { kind: "ok" } : { kind: "skipped", reason: "typescript is not a dependency; not applicable to a JavaScript project" },
    ),
  run: (ctx) => Promise.resolve(assess(ctx)),
};
