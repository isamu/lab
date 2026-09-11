import type { Contributor, Finding, Probe, ProbeContext, ProbeResult, SourceFile } from "../plugin.ts";
import { slocOf } from "../files.ts";
import { maximum, percentile, total } from "../stats.ts";

/**
 * The size of files (spec §13.1).
 *
 * Percentiles and the maximum, never the mean. Measured on two maintained repositories the median
 * was 63 lines in both, so the median discriminates nothing; the signal is in p95 (261 and 331)
 * and the maximum (622 and 1129).
 */

const GOD_FILE_LINES = 500;
const TOP_CONTRIBUTORS = 5;

interface Measured {
  readonly file: SourceFile;
  readonly sloc: number;
}

const measure = (files: readonly SourceFile[]): readonly Measured[] =>
  files.filter((file) => file.kind === "source").map((file) => ({ file, sloc: slocOf(file) }));

const largest = (measured: readonly Measured[]): readonly Contributor[] =>
  [...measured]
    .sort((a, b) => b.sloc - a.sloc)
    .slice(0, TOP_CONTRIBUTORS)
    .map(({ file, sloc }) => ({ file: file.path, value: sloc }));

const toFinding = ({ file, sloc }: Measured): Finding => ({
  rule: "god-file",
  severity: "warning",
  file: file.path,
  line: 1,
  message: `${sloc} lines (limit ${GOD_FILE_LINES})`,
  probe: "file-shape",
  dimension: "readability",
  tier: 0,
});

const assess = (ctx: ProbeContext): ProbeResult => {
  const started = Date.now();
  const measured = measure(ctx.files);
  const slocs = measured.map((m) => m.sloc);
  const godFiles = measured.filter((m) => m.sloc > GOD_FILE_LINES);
  return {
    probe: "file-shape",
    status: { kind: "ok" },
    metrics: [
      { id: "file-shape.sloc_p95", value: percentile(slocs, 0.95), unit: "lines", topContributors: largest(measured) },
      { id: "file-shape.max_file_sloc", value: maximum(slocs), unit: "lines" },
      { id: "file-shape.god_file_count", value: godFiles.length, unit: "count" },
      { id: "file-shape.source_file_count", value: measured.length, unit: "count" },
      { id: "file-shape.source_sloc", value: total(slocs), unit: "lines" },
    ],
    findings: godFiles.map(toFinding),
    toolVersions: {},
    durationMs: Date.now() - started,
  };
};

export const fileShape: Probe = {
  kind: "probe",
  id: "file-shape",
  apiVersion: 1,
  tier: 0,
  declares: ["file-shape.sloc_p95", "file-shape.max_file_sloc", "file-shape.god_file_count", "file-shape.source_file_count", "file-shape.source_sloc"],
  detect: (ctx) => Promise.resolve(ctx.files.some((f) => f.kind === "source") ? { kind: "ok" } : { kind: "absent", reason: "no source files" }),
  run: (ctx) => Promise.resolve(assess(ctx)),
};
