import type { Finding, Probe, ProbeContext, ProbeResult, SourceFile } from "../plugin.ts";
import { slocOf } from "../files.ts";
import { isUntypedSource } from "../stacks/ts.ts";

/**
 * TypeScript プロジェクトに残っている .js / .jsx を数える。
 *
 * `.js` のままのファイルは、型検査をファイル単位で丸ごと回避している。
 * `@ts-nocheck` を書くのと効果は同じで、しかもコード上に痕跡が残らない。
 *
 * typescript を持たない repo では警告しない。JavaScript のプロジェクトに
 * 「TypeScript にしろ」と言うのはこの probe の仕事ではない。
 */

const TOP_CONTRIBUTORS = 5;

const ratio = (part: number, whole: number): number => (whole === 0 ? 0 : Number((part / whole).toFixed(4)));

const toFinding = (file: SourceFile): Finding => ({
  rule: "untyped-source",
  severity: "warning",
  file: file.path,
  line: 1,
  message: "型検査の対象外です。.ts / .tsx にしてください",
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
          .sort((a, b) => b.value - a.value)
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
    Promise.resolve(ctx.project.typescript ? { kind: "ok" } : { kind: "skipped", reason: "typescript が依存にありません。JS プロジェクトには適用しません" }),
  run: (ctx) => Promise.resolve(assess(ctx)),
};
