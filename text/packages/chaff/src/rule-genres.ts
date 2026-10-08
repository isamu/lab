import type { Level, RuleDefinition } from "./plugin.ts";

/**
 * How a rule stands in one genre, with no chaff.yaml: the same order of precedence as a run (use_for, then the genre's
 * preset, then opt_in, then the rule's status).
 *   unsuited:     the rule is not for this kind of document (use_for), and does not run
 *   genre-off:    the genre's preset turns it off
 *   opt-in:       it runs only where chaff.yaml's style or rules give it a level
 *   experimental: it runs only with --experimental or a level in chaff.yaml
 *   on:           it runs, at this level
 */
export type GenreStanding =
  | { readonly kind: "unsuited" }
  | { readonly kind: "genre-off" }
  | { readonly kind: "opt-in" }
  | { readonly kind: "experimental" }
  | { readonly kind: "on"; readonly level: Exclude<Level, "off">; readonly byPreset: boolean };

type RuleFacts = Pick<RuleDefinition, "id" | "status" | "use_for" | "opt_in">;

export const standingIn = (rule: RuleFacts, genre: string, preset: Readonly<Record<string, Level>>): GenreStanding => {
  if (!rule.use_for.some((target) => genre.startsWith(target))) return { kind: "unsuited" };
  const fromPreset = preset[rule.id];
  if (fromPreset === "off") return { kind: "genre-off" };
  if (fromPreset !== undefined) return { kind: "on", level: fromPreset, byPreset: true };
  if (rule.opt_in === true) return { kind: "opt-in" };
  return rule.status === "experimental" ? { kind: "experimental" } : { kind: "on", level: "normal", byPreset: false };
};
