import type { Texts, UiLanguage } from "./ui.ts";

// How deep a rewrite goes, shallowest first. A rule's rewrite block says how deep its direction reaches, and
// chaff fix-plan --depth (or fix_plan.depth in chaff.yaml) says how deep the rewrite may go. A depth includes the
// shallower ones: a structure rewrite also fixes words and sentences. Pure.

export const REWRITE_DEPTHS = ["light", "structure", "register"] as const;

export type RewriteDepth = (typeof REWRITE_DEPTHS)[number];

/** A rule without a depth of its own, or without a rewrite block, fixes words and sentences. */
export const DEFAULT_DEPTH: RewriteDepth = "light";

export const isRewriteDepth = (value: unknown): value is RewriteDepth => REWRITE_DEPTHS.some((depth) => depth === value);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const rankOf = (depth: RewriteDepth): number => REWRITE_DEPTHS.indexOf(depth);

/** Whether a rewrite that may go as deep as `allowed` covers a rule whose direction reaches `needed`. */
export const depthIncludes = (allowed: RewriteDepth, needed: RewriteDepth): boolean => rankOf(needed) <= rankOf(allowed);

/** A depth as written: none, one chaff knows, or a value to report as it was written. */
export type DepthRead = { readonly depth: RewriteDepth | undefined } | { readonly unknown: string };

/** rewrite.depth, chaff.yaml's fix_plan.depth or --depth as written. Nothing written is no depth; anything else must be a depth. */
export const readDepth = (written: unknown): DepthRead => {
  if (written === undefined || written === null) return { depth: undefined };
  if (isRewriteDepth(written)) return { depth: written };
  return { unknown: typeof written === "string" ? written : (JSON.stringify(written) ?? typeof written) };
};

/** rewrite.depth of a rule's rewrite block, which is otherwise keyed by language. */
export const depthOfRewrite = (rewrite: unknown): DepthRead => (isRecord(rewrite) ? readDepth(rewrite["depth"]) : { depth: undefined });

const MEANING: Texts<Readonly<Record<RewriteDepth, string>>> = {
  ja: {
    light: "語と文を直す。構成と文体は残す",
    structure: "節・見出し・段落を組み替える",
    register: "文体を変える（です・ます → である、比べる言い方を外す など）",
  },
  en: {
    light: "words and sentences; the structure and the voice stay",
    structure: "sections, headings and paragraphs are reorganised",
    register: "the style is converted: polite to plain endings, comparatives removed and so on",
  },
};

/** What a depth means, in a reader's words. */
export const depthMeaning = (depth: RewriteDepth, ui: UiLanguage): string => MEANING[ui][depth];

/** Every depth with its meaning, shallowest first: "light (…) / structure (…) / register (…)". */
export const depthChoices = (ui: UiLanguage): string =>
  REWRITE_DEPTHS.map((depth) => (ui === "ja" ? `${depth}（${MEANING.ja[depth]}）` : `${depth} (${MEANING.en[depth]})`)).join(" / ");

/** Why a written depth cannot be read, with every depth chaff knows. where: what was written ("rewrite.depth", "--depth"). */
export const unknownDepthSentence = (where: string, written: string, ui: UiLanguage): string =>
  ui === "ja"
    ? `${where}: ${written} は書き直しの深さではありません。深さは ${depthChoices("ja")} のどれかで、深いほうは浅いほうを含みます。`
    : `${where}: ${written} is not a rewrite depth. A depth is one of ${depthChoices("en")}; a deeper one includes the shallower.`;
