import type { Span } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";

/** A figure joined to its unit by a hyphen ("a 3-month trial", "a 2-night, 3-day tour"), with the unit as written in the list. */
export type HyphenatedCount = Span & { readonly amount: number; readonly unit: string; readonly attributive: true };

const HYPHENS = "[-‐‑]";

const alternation = (units: readonly string[]): string =>
  units
    .filter((unit) => unit !== "")
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");

/**
 * Figures in digits joined by a hyphen to one of the units. The unit ends the word: "3-month-old" is an age and "3-monthly"
 * another word, and a figure inside a longer number or word ("2026-04-3-day", "v2-day") is not a count. Pure.
 */
export const hyphenatedCounts = (text: string, units: readonly string[]): HyphenatedCount[] => {
  const words = alternation(units);
  if (words === "") return [];
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}\\p{Pd}.,])(\\p{Nd}+)${HYPHENS}(${words})(?![\\p{L}\\p{N}\\p{Pd}])`, "giu");
  return [...text.matchAll(pattern)].flatMap((match): HyphenatedCount[] => {
    const unit = units.find((candidate) => candidate.toLowerCase() === (match[2] ?? "").toLowerCase());
    return unit === undefined
      ? []
      : [{ start: match.index, end: match.index + match[0].length, amount: Number((match[1] ?? "").normalize("NFKC")), unit, attributive: true }];
  });
};

/** The text before an attributive count without the article its noun takes ("up to a" → "up to"): a rough mark stands before it. Pure. */
export const withoutArticle = (before: string, articles: readonly string[]): string => {
  const trimmed = before.trimEnd();
  const lower = trimmed.toLowerCase();
  const article = articles.find((word) => word !== "" && (lower === word.toLowerCase() || lower.endsWith(` ${word.toLowerCase()}`)));
  return article === undefined ? trimmed : trimmed.slice(0, trimmed.length - article.length).trimEnd();
};
