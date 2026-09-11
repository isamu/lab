import type { Finding, Metric, ProbeResult, ProbeStatus, SourceFile } from "./plugin.ts";
import type { Rubric, ScoredDimension } from "./rubric.ts";
import { scoreDimension } from "./rubric.ts";
import { slocOf } from "./files.ts";
import { perKiloLines } from "./stats.ts";

export type Confidence = "high" | "medium" | "low";

const MEDIUM_ABOVE = 0.5;
const LOW_ABOVE = 2.0;

export interface DimensionReport extends ScoredDimension {
  readonly confidence: Confidence;
  readonly confidenceReason: string;
}

export interface ProbeReport {
  readonly probe: string;
  readonly status: ProbeStatus;
}

export interface Report {
  readonly schemaVersion: 1;
  readonly root: string;
  readonly complete: boolean;
  readonly size: { readonly files: number; readonly sloc: number; readonly testSloc: number };
  readonly dimensions: readonly DimensionReport[];
  readonly findings: readonly Finding[];
  readonly probes: readonly ProbeReport[];
  readonly overall: { readonly score: number; readonly comparable: false };
}

const collectMetrics = (results: readonly ProbeResult[]): ReadonlyMap<string, number> =>
  new Map(results.flatMap((r) => r.metrics).map((m: Metric) => [m.id, m.value]));

/**
 * 抑制が多い repo では、他の probe の測定値そのものが信用できない（spec §15.4）。
 * 減点するだけでなく、その次元の confidence を下げる。
 */
const confidenceOf = (rubric: Rubric, values: ReadonlyMap<string, number>, sloc: number): DimensionReport["confidence"] => {
  const density = perKiloLines(
    rubric.confidenceFrom.reduce((sum, id) => sum + (values.get(id) ?? 0), 0),
    sloc,
  );
  if (density >= LOW_ABOVE) return "low";
  if (density >= MEDIUM_ABOVE) return "medium";
  return "high";
};

const reasonOf = (rubric: Rubric, values: ReadonlyMap<string, number>): string => {
  const count = rubric.confidenceFrom.reduce((sum, id) => sum + (values.get(id) ?? 0), 0);
  return rubric.confidenceFrom.length === 0 ? "no suppression signal wired" : `${count} suppressions in scope`;
};

const slocOfKind = (files: readonly SourceFile[], kind: SourceFile["kind"]): number =>
  files.filter((f) => f.kind === kind).reduce((sum, f) => sum + slocOf(f), 0);

const mean = (values: readonly number[]): number => (values.length === 0 ? 0 : Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(4)));

export const buildReport = (root: string, files: readonly SourceFile[], results: readonly ProbeResult[], rubrics: readonly Rubric[]): Report => {
  const values = collectMetrics(results);
  const sloc = slocOfKind(files, "source");
  const dimensions = rubrics.map((rubric) => ({
    ...scoreDimension(rubric, values),
    confidence: confidenceOf(rubric, values, sloc),
    confidenceReason: reasonOf(rubric, values),
  }));
  return {
    schemaVersion: 1,
    root,
    complete: results.every((r) => r.status.kind !== "skipped"),
    size: { files: files.length, sloc, testSloc: slocOfKind(files, "test") },
    dimensions,
    findings: results.flatMap((r) => r.findings),
    probes: results.map((r) => ({ probe: r.probe, status: r.status })),
    overall: { score: mean(dimensions.map((d) => d.score)), comparable: false },
  };
};
