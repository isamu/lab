/**
 * Which of the three ways to rewrite (the guide's Light, Bold and Full) chaff recommends, from what it found alone.
 * A request that says "from scratch" also means Full; chaff cannot read the request, so the plan says so in words.
 */
export type FixMode = "none" | "light" | "bold" | "full";

/** Why the mode was chosen, so the plan can say it. */
export type ModeReason = "nothing-found" | "composite" | "genre" | "signals" | "spots";

export type ModeChoice = { readonly mode: FixMode; readonly reason: ModeReason };

export type ModeInput = {
  readonly genre: string;
  /** The rules with at least one finding. */
  readonly firedRules: ReadonlySet<string>;
  /** The rules that measure the whole document: ai-generated-composite's inputs and bold-density. */
  readonly signalRules: ReadonlySet<string>;
};

export const COMPOSITE_RULE = "ai-generated-composite";

/** Two document-wide signals mean the prose of the sections is the problem, not a spot or two. */
const MIN_SIGNALS_FOR_BOLD = 2;

/** A blog post or an essay is rewritten from its structure up: what the writer wants changed there is the structure. */
const isFreeFormGenre = (genre: string): boolean => genre.startsWith("blog/") || genre === "literature/essay";

export const recommendMode = (input: ModeInput): ModeChoice => {
  if (input.firedRules.size === 0) return { mode: "none", reason: "nothing-found" };
  if (input.firedRules.has(COMPOSITE_RULE)) return { mode: "full", reason: "composite" };
  if (isFreeFormGenre(input.genre)) return { mode: "full", reason: "genre" };
  const signals = [...input.firedRules].filter((rule) => input.signalRules.has(rule)).length;
  return signals >= MIN_SIGNALS_FOR_BOLD ? { mode: "bold", reason: "signals" } : { mode: "light", reason: "spots" };
};
