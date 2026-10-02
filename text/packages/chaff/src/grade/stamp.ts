import { createHash } from "node:crypto";
import type { Config } from "../config/load.ts";
import { sortedByKey } from "./order.ts";
import type { Stamp } from "./result.ts";

// The reproducibility stamp (spec §29.7). Two results are compared only when their rules and settings hashes match;
// the chaff version is recorded but not compared, so a release that only rewords messages keeps old results usable.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** JSON with every object's keys sorted, so the order a file or a map was written in does not change the hash. */
export const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, inner: unknown) => (isRecord(inner) ? sortedByKey(Object.entries(inner)) : inner)) ?? "null";

export const digestOf = (value: unknown): string => `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;

/** What decides which findings a run gives, other than the rules: chaff.yaml as it applies, the genre and --experimental. */
export type GradeSettings = {
  readonly config: Config;
  readonly experimental: boolean;
  /** --genre, which wins over chaff.yaml for every item that does not name its own. */
  readonly genre: string | undefined;
};

/** The parts of chaff.yaml that change a finding, a fact or a verdict. Paths and the AI judge do not. */
export const settingsOf = (settings: GradeSettings): Record<string, unknown> => {
  const { config } = settings;
  return {
    experimental: settings.experimental,
    genre: settings.genre ?? config.genre ?? null,
    language: config.language ?? null,
    profile: config.profile ?? null,
    rules: config.rules,
    limits: config.limits,
    options: config.options ?? {},
    style: config.style ?? null,
    styleApplied: config.applied ?? null,
    jargon: config.jargon,
    prefer: config.prefer,
    requiredSections: config.requiredSections,
    names: config.names,
    byPath: config.byPath,
    grade: config.grade ?? null,
  };
};

/** What the rules are: each language's rule definitions and word lists, the genres' presets and the document profiles. */
export type RuleSet = {
  readonly rules: Readonly<Record<string, unknown>>;
  readonly lexicons: Readonly<Record<string, unknown>>;
  readonly genres: unknown;
  readonly profiles: unknown;
};

export const stampOf = (versionLines: readonly string[], ruleSet: RuleSet, settings: GradeSettings): Stamp => ({
  chaff: versionLines.join(", "),
  rules: digestOf(ruleSet),
  settings: digestOf(settingsOf(settings)),
});
