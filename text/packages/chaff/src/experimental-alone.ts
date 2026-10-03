import type { Level, RuleDefinition } from "./plugin.ts";
import { standingIn } from "./rule-genres.ts";

type Written = { readonly rules: Readonly<Record<string, Level>>; readonly experimental: boolean };

/**
 * Whether naming the rule in chaff.yaml (npx chaffjs enable <id>) is all it takes to run it: it is off only because it is
 * experimental. Not when chaff.yaml already names it, the genre's preset decides it, the genre is not one it serves, or
 * the language is not one it reads; enable would change nothing there, and saying so would mislead.
 */
export const offOnlyAsExperimental = (
  rule: Pick<RuleDefinition, "id" | "status" | "use_for" | "languages">,
  written: Written,
  genre: string,
  preset: Readonly<Record<string, Level>>,
  language: string,
): boolean =>
  !written.experimental &&
  written.rules[rule.id] === undefined &&
  (rule.languages === undefined || rule.languages.includes(language)) &&
  standingIn(rule, genre, preset).kind === "experimental";
