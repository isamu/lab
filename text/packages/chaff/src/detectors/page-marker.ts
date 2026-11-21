import { escapeRegExp } from "../orthography.ts";
import type { LengthUnit } from "../plugin.ts";

/**
 * Page markers a converted print edition leaves inside a sentence ("( printed page 52044)", "[[Page 52044]]", 「－12－」).
 * They are the page break, not the writer's words. The shapes come from the lexicon: "#" stands for the page number and a
 * space for any run of spaces, none included. A marker touching a digit is part of a number (an address, 1－2－3).
 */
const NUMBER = "#";

const TEMPLATE_PARTS: Readonly<Record<string, string>> = { [NUMBER]: String.raw`\p{Nd}+`, " ": String.raw`\s*` };

const templatePattern = (template: string): string => [...template].map((char) => TEMPLATE_PARTS[char] ?? escapeRegExp(char)).join("");

/** One pattern for every page marker the lexicon names, or undefined when it names none. */
export const pageMarkerPattern = (templates: readonly string[]): RegExp | undefined =>
  templates.length === 0 ? undefined : new RegExp(String.raw`(?<!\p{Nd})(?:${templates.map(templatePattern).join("|")})(?!\p{Nd})`, "gu");

const sizeOf = (marker: string, unit: LengthUnit): number =>
  unit === "word" ? marker.split(/\s+/u).filter((word) => word.length > 0).length : marker.replace(/\s+/gu, "").length;

/** How much of a sentence its page markers take up, in the document's unit: their words, or their characters without spaces. */
export const pageMarkerSize = (text: string, pattern: RegExp | undefined, unit: LengthUnit): number => {
  if (pattern === undefined) return 0;
  return [...text.matchAll(pattern)].map((match) => match[0]).reduce((size, marker) => size + sizeOf(marker, unit), 0);
};
