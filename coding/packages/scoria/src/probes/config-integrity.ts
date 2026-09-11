import type { Finding, Probe, ProbeContext, ProbeResult, ConfigFile } from "../plugin.ts";
import { findConfig } from "../config-files.ts";
import { isRecord } from "../package-json.ts";

/**
 * Whether the project's own gates are configured at all, and how far they have been loosened.
 *
 * scoria measures a project against its own standards (spec §3.2). A repository with no ESLint
 * config does not score well on readability because its code is good; it scores whatever the
 * fallback preset happens to say. A repository with `strict: false` is not type-safe because tsc
 * reported nothing. Both are gaps in the measurement, and this probe is what makes them visible.
 */

const REQUIRED_SCRIPTS = ["lint", "build", "test"];
const TYPED_SCRIPTS = ["typecheck"];
const STRICT_FLAGS = ["strict", "noImplicitAny", "strictNullChecks"];
const FLAT_CONFIG_NAMES = ["eslint.config.js", "eslint.config.mjs", "eslint.config.cjs", "eslint.config.ts"];
const LEGACY_CONFIG_NAMES = [".eslintrc", ".eslintrc.js", ".eslintrc.json", ".eslintrc.yml", ".eslintrc.yaml", ".eslintrc.cjs"];

export interface Gap {
  readonly id: string;
  readonly severity: "error" | "warning";
  readonly title: string;
  readonly detail: string;
  readonly fixable: boolean;
}

const parseJson = (file: ConfigFile | undefined): Record<string, unknown> | undefined => {
  if (file === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(file.text);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const scriptsOf = (pkg: Record<string, unknown> | undefined): readonly string[] => {
  const scripts = pkg?.["scripts"];
  return isRecord(scripts) ? Object.keys(scripts) : [];
};

const eslintGaps = (files: readonly ConfigFile[]): readonly Gap[] => {
  const flat = FLAT_CONFIG_NAMES.filter((name) => findConfig(files, name) !== undefined);
  const legacy = LEGACY_CONFIG_NAMES.filter((name) => findConfig(files, name) !== undefined);
  if (flat.length === 0 && legacy.length === 0) {
    return [
      {
        id: "eslint-missing",
        severity: "error",
        title: "No ESLint configuration",
        detail:
          "readability is being measured against scoria's fallback, not against your standard. " + "The score is not wrong so much as about a different thing.",
        fixable: false,
      },
    ];
  }
  if (flat.length > 0 && legacy.length > 0) {
    return [
      {
        id: "eslint-duplicate",
        severity: "warning",
        title: "Both flat and legacy ESLint configs are present",
        detail: `${[...flat, ...legacy].join(", ")}. Which one applies depends on the ESLint version, so the effective rule set is ambiguous.`,
        fixable: false,
      },
    ];
  }
  return legacy.length > 0
    ? [
        {
          id: "eslint-legacy",
          severity: "warning",
          title: "ESLint is on the legacy .eslintrc format",
          detail: "ESLint 9 and later default to flat config; a legacy file may be silently ignored.",
          fixable: false,
        },
      ]
    : [];
};

const scriptGaps = (pkg: Record<string, unknown> | undefined, typescript: boolean): readonly Gap[] => {
  const present = scriptsOf(pkg);
  const wanted = typescript ? [...REQUIRED_SCRIPTS, ...TYPED_SCRIPTS] : REQUIRED_SCRIPTS;
  return wanted
    .filter((name) => !present.includes(name))
    .map((name) => ({
      id: `script-${name}`,
      severity: "warning" as const,
      title: `No \`${name}\` script`,
      detail: `CI cannot run what package.json does not define, so nothing enforces ${name}.`,
      fixable: name === "typecheck" && typescript,
    }));
};

const strictGaps = (tsconfig: Record<string, unknown> | undefined): readonly Gap[] => {
  if (tsconfig === undefined) return [];
  const options = tsconfig["compilerOptions"];
  if (!isRecord(options)) return [];
  if (options["strict"] === true) return [];
  const off = STRICT_FLAGS.filter((flag) => options[flag] !== true);
  return off.length === 0
    ? []
    : [
        {
          id: "tsconfig-strict",
          severity: "error",
          title: "TypeScript is not in strict mode",
          detail: `${off.join(", ")} not enabled. type-safety reads high because the checker was asked less, not because the types hold.`,
          fixable: false,
        },
      ];
};

const gitignoreGaps = (files: readonly ConfigFile[]): readonly Gap[] => {
  const gitignore = findConfig(files, ".gitignore");
  if (gitignore !== undefined && /^node_modules\/?$/m.test(gitignore.text)) return [];
  return [
    {
      id: "gitignore-node-modules",
      severity: "warning",
      title: "node_modules is not in .gitignore",
      detail: "One careless `git add` commits the dependency tree.",
      fixable: true,
    },
  ];
};

export const configGaps = (files: readonly ConfigFile[], typescript: boolean): readonly Gap[] => {
  const pkg = parseJson(findConfig(files, "package.json"));
  const tsconfig = parseJson(findConfig(files, "tsconfig.json"));
  return [...eslintGaps(files), ...scriptGaps(pkg, typescript), ...strictGaps(tsconfig), ...gitignoreGaps(files)];
};

/** Checks attempted, so the gap ratio is scale-free rather than a raw count. */
const CHECKS = 8;

const toFinding = (gap: Gap): Finding => ({
  rule: gap.id,
  severity: gap.severity,
  file: "package.json",
  line: 1,
  message: gap.title,
  probe: "config-integrity",
  dimension: "integrity",
  tier: 0,
});

const assess = (ctx: ProbeContext): ProbeResult => {
  const started = Date.now();
  const gaps = configGaps(ctx.configFiles, ctx.project.typescript);
  return {
    probe: "config-integrity",
    status: { kind: "ok" },
    metrics: [
      { id: "config-integrity.gap_ratio", value: Number((gaps.length / CHECKS).toFixed(4)), unit: "ratio" },
      { id: "config-integrity.gap_count", value: gaps.length, unit: "count" },
    ],
    findings: gaps.map(toFinding),
    toolVersions: {},
    durationMs: Date.now() - started,
  };
};

export const configIntegrity: Probe = {
  kind: "probe",
  id: "config-integrity",
  apiVersion: 1,
  tier: 0,
  declares: ["config-integrity.gap_ratio", "config-integrity.gap_count"],
  detect: (ctx) => Promise.resolve(ctx.configFiles.length > 0 ? { kind: "ok" } : { kind: "absent", reason: "no configuration files found" }),
  run: (ctx) => Promise.resolve(assess(ctx)),
};
