import { depthIncludes, type RewriteDepth } from "../rewrite-depth.ts";

/**
 * Which way to rewrite: the guide's Light, Bold and Full, and Register. Each is a rewrite depth (rewrite-depth.ts):
 * Light and Bold keep the structure (light), Full reorganises it (structure), Register converts the style (register).
 * chaff recommends a way from what it found; --depth or chaff.yaml's fix_plan.depth chooses the depth instead.
 * A request that says "from scratch" also means Full; chaff cannot read the request, so the plan says so in words.
 */
export type FixMode = "none" | "light" | "bold" | "full" | "register";

/** Why the mode was chosen, so the plan can say it. chosen: the depth was given; depth-limit: chaff would go deeper than the depth given. */
export type ModeReason = "nothing-found" | "all-deeper" | "composite" | "structure" | "genre" | "signals" | "spots" | "chosen" | "depth-limit";

export type ModeChoice = {
  readonly mode: FixMode;
  readonly reason: ModeReason;
  /** How deep the rewrite goes. None when there is nothing to fix. */
  readonly depth: RewriteDepth | undefined;
};

export type ModeInput = {
  readonly genre: string;
  /** The rules with at least one finding. */
  readonly firedRules: ReadonlySet<string>;
  /** The rules that measure the whole document: ai-generated-composite's inputs and bold-density. */
  readonly signalRules: ReadonlySet<string>;
  /** The structure score (measures past 90% of human articles) and the count at which the outline itself is the problem. */
  readonly structure?: { readonly score: number; readonly limit: number };
  /** The depth --depth or chaff.yaml chose. Without one, chaff recommends. */
  readonly chosen?: RewriteDepth | undefined;
  /** How many fired rules the chosen depth sets apart; they are not in firedRules. */
  readonly setApart?: number;
};

export const COMPOSITE_RULE = "ai-generated-composite";

const DEPTH_OF: Readonly<Record<FixMode, RewriteDepth | undefined>> = {
  none: undefined,
  light: "light",
  bold: "light",
  full: "structure",
  register: "register",
};

/** The way that goes exactly as deep as a chosen depth, beyond light, where chaff's recommendation picks Light or Bold. */
const MODE_AT: Readonly<Record<Exclude<RewriteDepth, "light">, FixMode>> = { structure: "full", register: "register" };

/** Two document-wide signals mean the prose of the sections is the problem, not a spot or two. */
const MIN_SIGNALS_FOR_BOLD = 2;

/** A blog post or an essay is rewritten from its structure up: what the writer wants changed there is the structure. */
const isFreeFormGenre = (genre: string): boolean => genre.startsWith("blog/") || genre === "literature/essay";

/** An outline far from human articles is rewritten from the outline, in any genre and whether or not a rule fired. */
const hasStructureToFix = (input: ModeInput): boolean => input.structure !== undefined && input.structure.score >= input.structure.limit;

const choice = (mode: FixMode, reason: ModeReason): ModeChoice => ({ mode, reason, depth: DEPTH_OF[mode] });

/** Two document-wide signals mean Bold, else Light: the deepest way that keeps the structure. */
const lightOrBold = (input: ModeInput): ModeChoice => {
  const signals = [...input.firedRules].filter((rule) => input.signalRules.has(rule)).length;
  return signals >= MIN_SIGNALS_FOR_BOLD ? choice("bold", "signals") : choice("light", "spots");
};

/** What chaff recommends from its findings alone. */
const recommended = (input: ModeInput): ModeChoice => {
  if (input.firedRules.has(COMPOSITE_RULE)) return choice("full", "composite");
  if (hasStructureToFix(input)) return choice("full", "structure");
  if (input.firedRules.size === 0) return choice("none", (input.setApart ?? 0) > 0 ? "all-deeper" : "nothing-found");
  if (isFreeFormGenre(input.genre)) return choice("full", "genre");
  return lightOrBold(input);
};

/** A chosen depth sets how deep the rewrite goes. At light, chaff still picks Light or Bold, and says when it would go deeper. */
const atChosenDepth = (input: ModeInput, chosen: RewriteDepth, ownChoice: ModeChoice): ModeChoice => {
  if (chosen !== "light") return ownChoice.depth === chosen ? ownChoice : choice(MODE_AT[chosen], "chosen");
  if (ownChoice.depth !== undefined && depthIncludes(chosen, ownChoice.depth)) return ownChoice;
  const within = lightOrBold(input);
  return { ...within, reason: "depth-limit" };
};

export const recommendMode = (input: ModeInput): ModeChoice => {
  const ownChoice = recommended(input);
  if (input.chosen === undefined || ownChoice.mode === "none") return ownChoice;
  return atChosenDepth(input, input.chosen, ownChoice);
};
