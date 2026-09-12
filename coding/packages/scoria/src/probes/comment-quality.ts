import type { Finding, Probe, ProbeContext, ProbeResult, SourceFile } from "../plugin.ts";
import { viewOf } from "../source-view.ts";
import { perKiloLines } from "../stats.ts";
import { rankByFile } from "./shared.ts";

/**
 * What the comments say about the state of the work (spec §13, `comment-quality`).
 *
 * Only markers are scored. The specification also lists `what_comment_ratio` — comments that
 * restate the line below them — and that is not implemented, deliberately: telling a comment that
 * explains *why* from one that repeats *what* means understanding both, and a wrong answer
 * punishes the comments worth keeping. A metric that cries wolf costs more than the metric is
 * worth, and with the ratchet able to fail a build on a finding it costs a build.
 *
 * `comment_density` is reported and not scored. Too few comments and too many are both bad, and a
 * linear scale (spec §16.2) cannot say that — it would have to call one end good.
 */

const MARKER = /\b(TODO|FIXME|XXX|HACK)\b/g;

const MAX_FINDINGS = 20;

interface Marker {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

const nonBlank = (lines: readonly string[]): number => lines.filter((line) => line.trim() !== "").length;

const markersIn = (file: SourceFile): readonly Marker[] =>
  viewOf(file.codeLines).comments.flatMap((line, index) => {
    const match = [...line.matchAll(MARKER)][0];
    return match === undefined ? [] : [{ file: file.path, line: index + 1, text: match[0] }];
  });

const toFinding = (marker: Marker): Finding => ({
  rule: "unfinished-marker",
  severity: "warning",
  file: marker.file,
  line: marker.line,
  message: `${marker.text} left in the code`,
  probe: "comment-quality",
  dimension: "documentation",
  tier: 0,
});

const assess = (ctx: ProbeContext): ProbeResult => {
  const started = Date.now();
  const source = ctx.files.filter((file) => file.kind === "source");
  const markers = source.flatMap(markersIn);
  const views = source.map((file) => viewOf(file.codeLines));
  const codeLines = views.reduce((sum, view) => sum + nonBlank(view.code), 0);
  const commentLines = views.reduce((sum, view) => sum + nonBlank(view.comments), 0);
  return {
    probe: "comment-quality",
    status: { kind: "ok" },
    metrics: [
      {
        id: "comment-quality.marker_per_kloc",
        value: perKiloLines(markers.length, codeLines),
        unit: "per_kloc",
        topContributors: rankByFile(markers.map((marker) => ({ file: marker.file, weight: 1 }))),
      },
      { id: "comment-quality.marker_count", value: markers.length, unit: "count" },
      { id: "comment-quality.comment_density", value: codeLines === 0 ? 0 : Number((commentLines / codeLines).toFixed(4)), unit: "ratio" },
    ],
    findings: markers.slice(0, MAX_FINDINGS).map(toFinding),
    toolVersions: {},
    durationMs: Date.now() - started,
  };
};

export const commentQuality: Probe = {
  kind: "probe",
  id: "comment-quality",
  apiVersion: 1,
  tier: 0,
  declares: ["comment-quality.marker_per_kloc", "comment-quality.marker_count", "comment-quality.comment_density"],
  detect: (ctx) => Promise.resolve(ctx.files.some((file) => file.kind === "source") ? { kind: "ok" } : { kind: "absent", reason: "no source files" }),
  run: (ctx) => Promise.resolve(assess(ctx)),
};
