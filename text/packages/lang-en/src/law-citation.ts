import type { Lexicon, LexiconEntry } from "chaffjs/plugin";
import { escapeRegExp } from "./regexp.ts";

// "Pub. L. 98–620, title IV, §402(2)" and "ch. 324, §2(a), 60 Stat. 237": a statute's notes cite a law by its number or by
// the volume that prints it. The section is that law's, not this document's. Which names are laws is the lexicon's
// (session-law). Pure.

/** Built once from the lexicon; each pattern is undefined when the lexicon names no law of its kind. */
export type LawVocabulary = { readonly before: RegExp | undefined; readonly after: RegExp | undefined };

/** A law's number is its Congress and its number in that Congress: "98–620", "89-487". */
const LAW_NUMBER = String.raw`\s+\d{1,3}[–-]\d{1,3}(?!\d)`;
/** "Pub. L. 98–620, " is far from "§402(2)" once "div. A, title IV, §201, title VI, " stands between them. */
const REACH = 160;
/**
 * What may stand between a law's number and its section: its divisions, titles, subtitles and parts, other sections of
 * it, and "formerly".
 * The gap is these and nothing else; a word of a sentence ("see", "and the Act") ends the citation.
 */
const CITATION_PART =
  /(?:div\.|subtitle|part|subchapter|ch\.)\s+[A-Z0-9]{1,4}|title\s+[IVXLC]{1,7}|formerly|§|\d{1,5}[A-Za-z]{0,2}|\([A-Za-z0-9]{1,4}\)|[\s,–-]/gu;
/** "§3.6, Dec. 29, 2009, 75 F.R. 718": a date may stand between a section and the volume's page. */
const DATE = String.raw`(?:,\s*[A-Z][a-z]{2,8}\.?\s+\d{1,2},\s+\d{4})?`;

const namesOf = (entries: readonly LexiconEntry[]): string | undefined => {
  const names = entries.map((entry) => entry.pattern).toSorted((left, right) => right.length - left.length);
  return names.length === 0 ? undefined : `(?:${names.map(escapeRegExp).join("|")})`;
};

export const lawVocabulary = (lexicons: Readonly<Record<string, Lexicon>>): LawVocabulary => {
  const entries = lexicons["session-law"] ?? [];
  const named = namesOf(entries.filter((entry) => entry.position === "before"));
  const volumes = namesOf(entries.filter((entry) => entry.position === "after"));
  return {
    before: named === undefined ? undefined : new RegExp(String.raw`(?<![\p{L}\p{N}])${named}${LAW_NUMBER}`, "gu"),
    after: volumes === undefined ? undefined : new RegExp(String.raw`^${DATE},\s*\d{1,3}\s+${volumes}\s+\d`, "u"),
  };
};

/** The last law named before `start` whose citation runs on, part by part, up to the reference. */
const lawBefore = (text: string, start: number, pattern: RegExp): string | undefined => {
  const window = text.slice(Math.max(0, start - REACH), start);
  const last = [...window.matchAll(pattern)].at(-1);
  if (last === undefined) return undefined;
  const gap = window.slice(last.index + last[0].length);
  return gap.replaceAll(CITATION_PART, "") === "" ? last[0] : undefined;
};

/**
 * The law a reference from `start` to `end` is a section of, or undefined when it is not cited as a law's section.
 * Named before it ("Pub. L. 98–620, §402(2)"), or by the volume after it ("§2(a), 60 Stat. 237"), which names the law
 * only by its page, so the volume stands for it.
 */
export const citedLawAround = (text: string, start: number, end: number, vocabulary: LawVocabulary): string | undefined => {
  const named = vocabulary.before === undefined ? undefined : lawBefore(text, start, vocabulary.before);
  if (named !== undefined) return named;
  const volume = vocabulary.after?.exec(text.slice(end, end + REACH))?.[0];
  return volume === undefined ? undefined : volume.replace(/^[\s,]+/u, "");
};
