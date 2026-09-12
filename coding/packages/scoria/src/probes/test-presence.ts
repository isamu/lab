import type { Probe, ProbeContext, ProbeResult } from "../plugin.ts";
import { slocOf } from "../files.ts";

/**
 * How much test code there is, relative to the code under test.
 *
 * This needs nothing installed, so it is the one measurement that still works on a repository with
 * no tooling — and it catches the case the scoring was built for: a project with no tests at all
 * scores zero rather than going unmeasured (spec §18).
 *
 * It counts lines rather than matching file names. Name matching was tried first and measured the
 * wrong thing: scoria's own tests are organised by concern, so one file covers several modules, and
 * the match reported 81% of a repository with 88 passing tests as untested. A number that moves
 * when files are renamed, and not when tests are written, is worse than no number.
 *
 * The ratio cannot say whether the tests assert anything — that is what mutation testing answers,
 * and it is not here yet.
 */

const assess = (ctx: ProbeContext): ProbeResult => {
  const started = Date.now();
  const slocIn = (kind: "source" | "test"): number => ctx.files.filter((file) => file.kind === kind).reduce((sum, file) => sum + slocOf(file), 0);
  const source = slocIn("source");
  const test = slocIn("test");
  return {
    probe: "test-presence",
    status: { kind: "ok" },
    metrics: [
      {
        id: "test-presence.test_to_source_ratio",
        value: source === 0 ? 0 : Number((test / source).toFixed(4)),
        unit: "ratio",
      },
      { id: "test-presence.test_sloc", value: test, unit: "lines" },
      { id: "test-presence.test_file_count", value: ctx.files.filter((f) => f.kind === "test").length, unit: "count" },
    ],
    findings: [],
    toolVersions: {},
    durationMs: Date.now() - started,
  };
};

export const testPresence: Probe = {
  kind: "probe",
  id: "test-presence",
  apiVersion: 1,
  tier: 0,
  declares: ["test-presence.test_to_source_ratio", "test-presence.test_sloc", "test-presence.test_file_count"],
  detect: (ctx) => Promise.resolve(ctx.files.some((file) => file.kind === "source") ? { kind: "ok" } : { kind: "absent", reason: "no source files" }),
  run: (ctx) => Promise.resolve(assess(ctx)),
};
