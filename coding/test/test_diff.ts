import { test } from "node:test";
import assert from "node:assert/strict";
import { diffReports } from "../packages/scoria/src/diff.ts";
import { buildReport } from "../packages/scoria/src/report.ts";
import type { Rubric } from "../packages/scoria/src/rubric.ts";
import type { ProbeResult, SourceFile } from "../packages/scoria/src/plugin.ts";

const rubrics: readonly Rubric[] = [
  {
    id: "readability",
    status: "experimental",
    metrics: [
      { metric: "file-shape.sloc_p95", scale: { good: 150, bad: 800 }, weight: 0.7 },
      { metric: "file-shape.god_file_count", scale: { good: 0, bad: 20 }, weight: 0.3 },
    ],
    confidenceFrom: [],
  },
];

const files: readonly SourceFile[] = [{ path: "a.ts", kind: "source", lines: ["const a = 1;"] }];

const resultWith = (p95: number, godFiles: number): ProbeResult => ({
  probe: "file-shape",
  status: { kind: "ok" },
  metrics: [
    { id: "file-shape.sloc_p95", value: p95, unit: "lines" },
    { id: "file-shape.god_file_count", value: godFiles, unit: "count" },
  ],
  findings: [],
  toolVersions: {},
  durationMs: 0,
});

const reportWith = (p95: number, godFiles: number) => buildReport(".", files, [resultWith(p95, godFiles)], rubrics);

/**
 * scale を線形に固定した理由そのもの (spec §16.2, §26.3)。
 * 非線形を入れた瞬間にこのテストが落ちる。設計判断を守るために置いている。
 */
test("movers の points の合計は dimension の delta に一致する", () => {
  const diff = diffReports(reportWith(200, 2), reportWith(400, 5));
  const delta = diff.dimensions.find((d) => d.dimension === "readability")?.delta ?? 0;
  const sum = diff.movers.filter((m) => m.dimension === "readability").reduce((acc, m) => acc + m.points, 0);
  assert.ok(Math.abs(delta - sum) < 1e-6, `delta ${delta} != Σ movers ${sum}`);
  assert.ok(delta < 0);
});

test("改善したときも加法性が保たれる", () => {
  const diff = diffReports(reportWith(600, 9), reportWith(180, 1));
  const delta = diff.dimensions.find((d) => d.dimension === "readability")?.delta ?? 0;
  const sum = diff.movers.reduce((acc, m) => acc + m.points, 0);
  assert.ok(Math.abs(delta - sum) < 1e-6);
  assert.ok(delta > 0);
});

test("動かなかった metric は movers に出ない", () => {
  const diff = diffReports(reportWith(200, 3), reportWith(400, 3));
  assert.deepEqual(
    diff.movers.map((m) => m.metric),
    ["file-shape.sloc_p95"],
  );
});

test("差分が無ければ movers は空", () => {
  const diff = diffReports(reportWith(200, 3), reportWith(200, 3));
  assert.deepEqual(diff.movers, []);
});
