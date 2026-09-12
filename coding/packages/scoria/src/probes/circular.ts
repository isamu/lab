import type { Finding, Probe, ProbeContext, ProbeResult } from "../plugin.ts";
import { resolveBin } from "../bin-resolve.ts";
import { skippedResult } from "./shared.ts";

/**
 * Import cycles: A reaching B reaching A.
 *
 * knip finds code nothing reaches; this finds code tangled together, which is the opposite failure
 * and invisible to it. A cycle breaks initialisation in an order that depends on which file is
 * imported first, makes a module impossible to load alone in a test, and means extracting one file
 * drags the whole ring with it.
 *
 * The original design named dependency-cruiser. It resolved nothing on real repositories even with
 * a config and a tsconfig, while madge covers 178 files in 1.2 seconds and reports the path. The
 * cost of the swap is dependency-cruiser's layer rules, which madge cannot express.
 */

const EXTENSIONS = "ts,tsx,mts,cts,js,jsx,mjs,vue";
const MAX_FINDINGS = 20;

const parse = (stdout: string): readonly (readonly string[])[] | undefined => {
  try {
    const parsed: unknown = JSON.parse(stdout);
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter((cycle): cycle is string[] => Array.isArray(cycle) && cycle.every((s) => typeof s === "string"));
  } catch {
    return undefined;
  }
};

/** The finding lands on the first file of the ring; the message carries the path round it. */
const toFinding = (cycle: readonly string[]): Finding => ({
  rule: "circular-dependency",
  severity: "warning",
  file: cycle[0] ?? "",
  line: 1,
  message: `import cycle: ${[...cycle, cycle[0] ?? ""].join(" → ")}`,
  probe: "circular",
  dimension: "architecture",
  tier: 1,
});

const run = async (ctx: ProbeContext): Promise<ProbeResult> => {
  const started = Date.now();
  const bin = resolveBin("madge", "madge");
  if (bin === undefined) return skippedResult("circular", "madge is not installed alongside scoria", started);
  const result = await ctx.execNode(bin, ["--circular", "--json", "--extensions", EXTENSIONS, ctx.root]);
  const cycles = parse(result.stdout);
  if (cycles === undefined) return skippedResult("circular", "madge produced no readable report", started);
  return {
    probe: "circular",
    status: { kind: "ok" },
    metrics: [{ id: "circular.cycle_count", value: cycles.length, unit: "count" }],
    findings: cycles.slice(0, MAX_FINDINGS).map(toFinding),
    toolVersions: { madge: (await ctx.execNode(bin, ["--version"])).stdout.trim() },
    durationMs: Date.now() - started,
  };
};

export const circular: Probe = {
  kind: "probe",
  id: "circular",
  apiVersion: 1,
  tier: 1,
  declares: ["circular.cycle_count"],
  detect: (ctx) => Promise.resolve(ctx.project.installed ? { kind: "ok" } : { kind: "skipped", reason: "the project's dependencies are not installed" }),
  run,
};
