import { join } from "node:path";
import type { Finding, Probe, ProbeContext, ProbeResult } from "../plugin.ts";
import { viewOf } from "../source-view.ts";

/**
 * Whether the repository explains itself, and whether that explanation still matches the code
 * (spec §13, `readme-contract`).
 *
 * The interesting half is the second. A README that exists is easy; a README that still lists the
 * flags the program accepts is the thing that rots first, because adding a flag and documenting it
 * are two separate acts and only one of them is needed to ship.
 *
 * Flags are read out of the string literals, which is where a flag a program accepts lives. Reading
 * the code view finds none of them, and reading the raw lines finds every flag any comment happens
 * to mention — including other tools' — and then demands the README document those too.
 */

const README_NAMES = ["README.md", "readme.md", "Readme.md", "README.markdown", "README"];

/** Scanned over string literals only, so a bare match is enough — no word-boundary guards. */
const FLAG = /--[a-z][a-z0-9-]{1,30}/g;

/**
 * Flags a consumer could type, taken from the code rather than from `--help` output, because
 * running the program to ask it is exactly what scoria does not do.
 *
 * Only files that read `argv` are scanned. Every flag string in a program is a candidate otherwise,
 * and most of them are arguments it passes to something else — scoria's own source mentions 24,
 * of which two thirds are jscpd's and knip's. Demanding a README document `--min-tokens` is the
 * kind of false positive that teaches people to ignore the finding.
 *
 * The cost is a program whose flags are declared through a parser library that hides argv: its
 * flags go unfound, and the metric is skipped rather than scored against a partial list.
 */
const READS_ARGV = /\bargv\b/;

/**
 * A file that both parses its own arguments and launches another program contributes that
 * program's options too. scoria's own cli.ts does not, but a smaller CLI commonly does, and
 * demanding the README document another tool's flags is the false positive this whole search has
 * been narrowing away from.
 */
const SPAWNS = /\b(?:execFile|execFileSync|spawnSync?|exec)\s*\(/;

const flagsIn = (files: readonly { readonly codeLines: readonly string[] }[]): ReadonlySet<string> => {
  const found = files.flatMap((file) => {
    const view = viewOf(file.codeLines);
    const code = view.code.join("\n");
    if (!READS_ARGV.test(code) || SPAWNS.test(code)) return [];
    return [...view.strings.join("\n").matchAll(FLAG)].map((match) => match[0]);
  });
  return new Set(found);
};

const wordsIn = (text: string): number => text.split(/\s+/).filter((word) => word !== "").length;

const readReadme = async (ctx: ProbeContext): Promise<string | undefined> => {
  const texts = await Promise.all(README_NAMES.map((name) => ctx.readText(join(ctx.root, name))));
  return texts.find((text) => text !== undefined);
};

const missingFinding = (flags: readonly string[]): readonly Finding[] => [
  {
    rule: "undocumented-flags",
    severity: "warning",
    file: "README.md",
    line: 1,
    message: `${flags.length} ${flags.length === 1 ? "flag is" : "flags are"} accepted but not in the README: ${flags.slice(0, 5).join(", ")}`,
    probe: "readme-contract",
    dimension: "documentation",
    tier: 0,
  },
];

const share = (part: number, whole: number): number => (whole === 0 ? 0 : Number((part / whole).toFixed(4)));

const run = async (ctx: ProbeContext): Promise<ProbeResult> => {
  const started = Date.now();
  const text = await readReadme(ctx);
  const flags = [...flagsIn(ctx.files.filter((file) => file.kind === "source"))];
  const undocumented = text === undefined ? flags : flags.filter((flag) => !text.includes(flag));
  // Emitted only where there are flags to document; elsewhere the metric is skipped, not zero.
  const flagMetric =
    flags.length === 0
      ? []
      : [{ id: "readme-contract.documented_flag_ratio", value: share(flags.length - undocumented.length, flags.length), unit: "ratio" as const }];
  return {
    probe: "readme-contract",
    status: { kind: "ok" },
    metrics: [
      { id: "readme-contract.has_readme", value: text === undefined ? 0 : 1, unit: "count" },
      { id: "readme-contract.readme_words", value: text === undefined ? 0 : wordsIn(text), unit: "count" },
      ...flagMetric,
    ],
    findings: undocumented.length > 0 && text !== undefined ? missingFinding(undocumented) : [],
    toolVersions: {},
    durationMs: Date.now() - started,
  };
};

export const readmeContract: Probe = {
  kind: "probe",
  id: "readme-contract",
  apiVersion: 1,
  tier: 0,
  declares: ["readme-contract.has_readme", "readme-contract.readme_words", "readme-contract.documented_flag_ratio"],
  detect: () => Promise.resolve({ kind: "ok" }),
  run,
};
