import type { Finding, Probe, ProbeContext, ProbeResult } from "../plugin.ts";
import { sourceSloc } from "../files.ts";
import { perKiloLines } from "../stats.ts";
import { resolveBin } from "../bin-resolve.ts";
import { isRecord } from "../package-json.ts";
import { rankByFile, relativeTo, skippedResult } from "./shared.ts";

/**
 * Lints the target with scoria's own ruleset (spec §3.2).
 *
 * oxlint rather than ESLint because the ruleset must not depend on the target's node_modules
 * (spec §3.2.1): it runs standalone, parses .ts/.tsx/.js/.jsx/.vue itself, and covers 313 files
 * in under two seconds.
 *
 * Measuring against the project's own config was the original design and was wrong — a repository
 * that turns off every rule would then score perfectly.
 */

/**
 * correctness is denied and the rest warned, so the two severities mean different things:
 * an error is a rule oxlint considers a probable defect, a warning is a smell.
 */
const DENIED = ["correctness"];
const WARNED = ["suspicious", "perf"];
const MAX_FINDINGS = 40;

interface Diagnostic {
  readonly code: string;
  readonly filename: string;
  readonly message: string;
  readonly severity: string;
  readonly line: number;
}

const asNumber = (value: unknown): number => (typeof value === "number" ? value : 0);
const asString = (value: unknown): string => (typeof value === "string" ? value : "");

/** oxlint reports a label range; only the first line is needed to point at the code. */
const lineOf = (raw: Record<string, unknown>): number => {
  const labels: unknown = raw["labels"];
  if (!Array.isArray(labels)) return 1;
  const first: unknown = labels[0];
  return isRecord(first) ? Math.max(1, asNumber(first["line"])) : 1;
};

const toDiagnostic = (raw: unknown): Diagnostic | undefined =>
  isRecord(raw)
    ? {
        code: asString(raw["code"]),
        filename: asString(raw["filename"]),
        message: asString(raw["message"]),
        severity: asString(raw["severity"]),
        line: lineOf(raw),
      }
    : undefined;

const parse = (stdout: string): readonly Diagnostic[] => {
  try {
    const parsed: unknown = JSON.parse(stdout);
    const diagnostics = isRecord(parsed) ? parsed["diagnostics"] : undefined;
    if (!Array.isArray(diagnostics)) return [];
    return diagnostics.flatMap((entry) => {
      const diagnostic = toDiagnostic(entry);
      return diagnostic === undefined ? [] : [diagnostic];
    });
  } catch {
    return [];
  }
};

/** `eslint(no-await-in-loop)` and `unicorn(no-array-sort)` — the plugin prefix is not the rule. */
const ruleOf = (code: string): string => code.replace(/^[a-z-]+\(/, "").replace(/\)$/, "");

const toFinding = (root: string, diagnostic: Diagnostic): Finding => ({
  rule: `oxlint/${ruleOf(diagnostic.code)}`,
  severity: diagnostic.severity === "error" ? "error" : "warning",
  file: relativeTo(root, diagnostic.filename),
  line: diagnostic.line,
  message: diagnostic.message,
  probe: "oxlint",
  dimension: "correctness",
  tier: 0,
});

const run = async (ctx: ProbeContext): Promise<ProbeResult> => {
  const started = Date.now();
  const bin = resolveBin("oxlint", "oxlint");
  if (bin === undefined) return skippedResult("oxlint", "oxlint is not installed alongside scoria", started);
  const args = [...DENIED.flatMap((category) => ["-D", category]), ...WARNED.flatMap((category) => ["-W", category]), "--format", "json", ctx.root];
  const result = await ctx.execNode(bin, args);
  const diagnostics = parse(result.stdout);
  const sloc = sourceSloc(ctx.files);
  const errors = diagnostics.filter((entry) => entry.severity === "error");
  return {
    probe: "oxlint",
    status: { kind: "ok" },
    metrics: [
      {
        id: "oxlint.violations_per_kloc",
        value: perKiloLines(diagnostics.length, sloc),
        unit: "per_kloc",
        topContributors: rankByFile(diagnostics.map((entry) => ({ file: relativeTo(ctx.root, entry.filename), weight: 1 }))),
      },
      { id: "oxlint.violations", value: diagnostics.length, unit: "count" },
      { id: "oxlint.errors_per_kloc", value: perKiloLines(errors.length, sloc), unit: "per_kloc" },
    ],
    findings: diagnostics.slice(0, MAX_FINDINGS).map((entry) => toFinding(ctx.root, entry)),
    toolVersions: { oxlint: (await ctx.execNode(bin, ["--version"])).stdout.trim() },
    durationMs: Date.now() - started,
  };
};

export const oxlint: Probe = {
  kind: "probe",
  id: "oxlint",
  apiVersion: 1,
  tier: 0,
  declares: ["oxlint.violations_per_kloc", "oxlint.violations", "oxlint.errors_per_kloc"],
  detect: (ctx) => Promise.resolve(ctx.files.some((file) => file.kind === "source") ? { kind: "ok" } : { kind: "absent", reason: "no source files" }),
  run,
};
