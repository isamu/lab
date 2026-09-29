import type { Mention, NumberedLine, NumberingContext, StructurePatterns } from "chaffjs/plugin";
import { citedDocumentAfter, citedDocumentBefore } from "./citation.ts";
import { membersAfter } from "./reference-list.ts";
import { parseRoman } from "./roman.ts";
import { dates } from "./dates.ts";
import { definitionScopeDepth, definitions, opensDefinitionScope } from "./definitions.ts";
import { CHAPTER_DEPTH, PART_DEPTH } from "./depth.ts";
import { continuesAddress, continuesOpen, depthFor, INSERTED, ordinalOf, styleOf } from "./item-style.ts";

// Contracts, specifications and statutes in English. core nests what this reads; it does not know
// how English numbers its articles.

const numberOf = (text: string | undefined): string | undefined => {
  if (text === undefined) return undefined;
  if (/^\d{1,3}(?:\.\d{1,3}){0,5}$/u.test(text)) return text;
  const roman = parseRoman(text);
  return roman === undefined ? undefined : String(roman);
};

/**
 * A heading is the number followed by nothing, punctuation, or a capitalised title.
 * "Article 3 shall apply to…" at the start of a line is a sentence, not the heading of Article 3.
 */
const titleOf = (rest: string): string | undefined => {
  const trimmed = rest.replace(/^[.:\-–—\s]+/u, "").trim();
  if (trimmed !== "" && /^\p{Ll}/u.test(trimmed)) return undefined;
  return trimmed;
};

const ARTICLE = /^\s{0,3}(?:ARTICLE|Article)\s+(?<n>\d{1,3}|[IVXLC]{1,7})\b(?<rest>.*)$/u;
const SECTION = /^\s{0,3}(?:SECTION|Section|§)\s*(?<n>\d{1,3}(?:\.\d{1,3}){0,5})\b(?<rest>.*)$/u;
/** "(a) text", "(ii) text", "(B) text", or the label alone on its line with the text below it. */
const LETTERED = new RegExp(`^\\s{0,6}\\((?<n>[a-z]{1,4}|[A-Z]{1,4}|\\d{1,3}|${INSERTED})\\)(?:\\s+(?<rest>\\S.*))?\\s*$`, "u");

const headed = (pattern: RegExp, line: string, numbering: string, label: (n: string) => string): NumberedLine | undefined => {
  const groups = pattern.exec(line)?.groups;
  const number = numberOf(groups?.["n"]);
  const heading = titleOf(groups?.["rest"] ?? "");
  if (groups === undefined || number === undefined || heading === undefined) return undefined;
  const parts = number.split(".");
  return {
    kind: "article",
    depth: parts.length,
    number,
    absolute: true,
    label: label(groups["n"] ?? ""),
    heading,
    rest: heading,
    ordinal: Number(parts.at(-1)),
    numbering,
  };
};

const lettered = (line: string, context: NumberingContext): NumberedLine | undefined => {
  const groups = LETTERED.exec(line)?.groups;
  const raw = groups?.["n"];
  if (groups === undefined || raw === undefined) return undefined;
  const style = styleOf(raw, context);
  const ordinal = style === undefined ? undefined : ordinalOf(raw, style);
  const rest = groups["rest"];
  if (style === undefined || (rest === undefined && !continuesOpen(style, ordinal, context))) return undefined;
  // 番地は書かれたままの "ii" を使う。参照「Section 4.2(a)(ii)」も同じ形で書かれるので、そのまま引ける。
  return {
    kind: "item",
    depth: depthFor(style, context, ordinal),
    ordinal,
    number: raw,
    absolute: false,
    label: `(${raw})`,
    heading: "",
    rest: rest?.trim() ?? "",
  };
};

/** Chapters restart in each part, so a chapter continues its part's address: PART II, CHAPTER 1 → pt2.ch1. */
const PART = /^\s{0,3}(?:PART|Part)\s+(?<n>\d{1,3}|[IVXLC]{1,7})\b(?<rest>.*)$/u;
const CHAPTER = /^\s{0,3}(?:CHAPTER|Chapter)\s+(?<n>\d{1,3}|[IVXLC]{1,7})\b(?<rest>.*)$/u;

const chapter = (pattern: RegExp, line: string, depth: number, prefix: string, word: string): NumberedLine | undefined => {
  const groups = pattern.exec(line)?.groups;
  const number = numberOf(groups?.["n"]);
  const heading = titleOf(groups?.["rest"] ?? "");
  if (groups === undefined || number === undefined || heading === undefined) return undefined;
  const label = `${word} ${groups["n"] ?? ""}`;
  return { kind: "chapter", depth, number: prefix + number, absolute: false, label, heading, rest: heading, ordinal: Number(number) };
};

const numbered = (line: string, context: NumberingContext): NumberedLine | undefined =>
  chapter(PART, line, PART_DEPTH, "pt", "Part") ??
  chapter(CHAPTER, line, CHAPTER_DEPTH, "ch", "Chapter") ??
  headed(ARTICLE, line, "article", (n) => `Article ${n}`) ??
  headed(SECTION, line, "section", (n) => `Section ${n}`) ??
  lettered(line, context);

const REFERENCE = /(?<word>\b[Ss]ections?|\b[Aa]rticles?|§) ?(?<n>\d{1,3}(?:\.\d{1,3}){0,5}|[IVXLC]{1,7})\b/gu;
/** "(a)", "(ii)", "(3)", "(B)", and an inserted "(A1)" or "(2A)": the same labels the tree reads. */
const SUBDIVISION = new RegExp(`^\\((?<p>[a-z0-9]{1,4}|[A-Z]{1,4}|${INSERTED})\\)`, "u");
/** The longest label, with its parentheses: "(ZZ999)". */
const MAX_SUBDIVISION_LENGTH = 7;

/** "(a)(1)(i)(A)(1)", a US regulation's deepest paragraph, is as deep as a reference goes; more parentheses are text. */
const MAX_SUBDIVISIONS = 5;

/**
 * "(a)(ii)" のような続きの括弧を、正規表現を複雑にせずに一つずつ読む。
 * 再帰にしないのは、括弧が延々と続く行でスタックを使い切らないため。
 */
const subdivisions = (text: string, from: number): { readonly parts: readonly string[]; readonly end: number } => {
  const parts: string[] = [];
  let end = from;
  while (parts.length < MAX_SUBDIVISIONS) {
    const part = SUBDIVISION.exec(text.slice(end, end + MAX_SUBDIVISION_LENGTH))?.groups?.["p"];
    if (part === undefined || !continuesAddress(part, parts)) break;
    parts.push(part);
    end += part.length + 2;
  }
  return { parts, end };
};

/** Parentheses opened and not yet closed in `between`. */
const PAREN_STEP: Readonly<Record<string, number>> = { "(": 1, ")": -1 };

/**
 * "section 120(3) of the Communications Act 2003 (conditions under section 120 …)": a gloss in parentheses after
 * a reference into another document describes that document, so the references in it are into it too — until the
 * parenthesis the reference stood in closes. One pass over the line, however many references it holds.
 */
type Gloss = { depth: number; scanned: number; readonly anchors: { readonly document: string; readonly depth: number }[] };

const advance = (gloss: Gloss, text: string, to: number): void => {
  for (let index = gloss.scanned; index < to; index += 1) {
    gloss.depth += PAREN_STEP[text[index] ?? ""] ?? 0;
    while ((gloss.anchors.at(-1)?.depth ?? -Infinity) > gloss.depth) gloss.anchors.pop();
  }
  gloss.scanned = Math.max(gloss.scanned, to);
};

const glossedDocument = (gloss: Gloss): string | undefined => {
  const anchor = gloss.anchors.at(-1);
  return anchor !== undefined && gloss.depth > anchor.depth ? anchor.document : undefined;
};

/**
 * "Section 4.2(a)" → 4.2.a, "Article III" → 3. The same addresses the tree gives.
 * "Section 9 of the Master Agreement" carries the other document's name, and is not looked up in this tree.
 */
const references = (text: string): Mention[] => {
  const gloss: Gloss = { depth: 0, scanned: 0, anchors: [] };
  return [...text.matchAll(REFERENCE)].flatMap((match) => {
    const main = numberOf(match.groups?.["n"]);
    if (main === undefined) return [];
    const { parts, end } = subdivisions(text, match.index + match[0].length);
    advance(gloss, text, match.index);
    const cited = citedDocumentAfter(text, end) ?? citedDocumentBefore(text, match.index);
    const document = cited ?? glossedDocument(gloss);
    gloss.scanned = Math.max(gloss.scanned, end);
    if (cited !== undefined) gloss.anchors.push({ document: cited, depth: gloss.depth });
    const numbering = /^[Aa]/u.test(match.groups?.["word"] ?? "") ? "article" : "section";
    const shared = { numbering, ...(document === undefined ? {} : { document }) };
    const first = { start: match.index, end, attrs: { target: [main, ...parts].join("."), label: text.slice(match.index, end), ...shared } };
    const [plural, roman] = [/s$/u.test(match.groups?.["word"] ?? ""), /^[IVXLC]+$/u.test(match.groups?.["n"] ?? "")];
    return [first, ...membersAfter(text, end, [main, ...parts], shared, plural, roman)];
  });
};

/** Longest first, and never inside a word: "shall not" is not also "shall", "mayor" is not "may". */
const MARKERS: readonly (readonly [string, "must" | "must-not" | "may"])[] = [
  ["is required to", "must"],
  ["shall not", "must-not"],
  ["must not", "must-not"],
  ["may not", "must-not"],
  ["agrees to", "must"],
  ["shall", "must"],
  ["must", "must"],
  ["may", "may"],
];

const isWordChar = (char: string | undefined): boolean => char !== undefined && /[\p{L}\p{N}_]/u.test(char);

/** Every whole-word occurrence. A loop, not recursion: a line with thousands of "may" must not exhaust the stack. */
const wordAt = (lower: string, word: string): number[] => {
  const found: number[] = [];
  for (let at = lower.indexOf(word); at !== -1; at = lower.indexOf(word, at + 1)) {
    if (!isWordChar(lower[at - 1]) && !isWordChar(lower[at + word.length])) found.push(at);
  }
  return found;
};

const SENTENCE_OPENERS = new Set([".", "!", "?", ":", ";", '"', "“", "("]);

/** "May" in the middle of a sentence is the month: "published in May 2023". At the start it can be the modal. */
const isMonthName = (text: string, at: number): boolean => {
  if (!text.startsWith("May", at)) return false;
  const before = text.slice(Math.max(0, at - 4), at).trimEnd();
  return before !== "" && !SENTENCE_OPENERS.has(before.at(-1) ?? "");
};

/**
 * Longest marker first; a hit that overlaps one already kept is dropped. Overlap is checked with a mark
 * per character, not by comparing every pair, which would go quadratic on a line with thousands of markers.
 */
const obligations = (text: string): Mention[] => {
  const lower = text.toLowerCase();
  const taken = new Uint8Array(text.length);
  const kept: Mention[] = [];
  MARKERS.forEach(([marker, type]) => {
    wordAt(lower, marker).forEach((start) => {
      const end = start + marker.length;
      if (isMonthName(text, start)) return;
      if (taken.subarray(start, end).some((mark) => mark === 1)) return;
      taken.fill(1, start, end);
      kept.push({ start, end, attrs: { marker, type } });
    });
  });
  return kept.sort((left, right) => left.start - right.start);
};

/** Find the number first, then look at what is right before (a currency) and right after (a unit). */
const NUMBER_RUN = /\d[\d,.]{0,15}/gu;
const UNITS = [
  "business days",
  "business day",
  "calendar days",
  "calendar day",
  "days",
  "day",
  "weeks",
  "week",
  "months",
  "month",
  "years",
  "year",
  "hours",
  "hour",
  "minutes",
  "minute",
  "percent",
  "times",
  "%",
];
const CURRENCIES = ["USD", "EUR", "$", "€", "£"];

/** "30." の終わりの点は文の終わり。数の一部にしない。 */
const withoutTrailingPunctuation = (run: string): string => {
  let end = run.length;
  while (end > 0 && (run[end - 1] === "." || run[end - 1] === ",")) end -= 1;
  return run.slice(0, end);
};

/** One space or tab may sit between a number and its unit or currency. */
const isGap = (char: string | undefined): boolean => char === " " || char === "\t";

const unitAfter = (text: string, from: number): string | undefined => {
  const gap = isGap(text[from]) ? 1 : 0;
  const unit = UNITS.find((candidate) => text.startsWith(candidate, from + gap) && !isWordChar(text[from + gap + candidate.length]));
  return unit;
};

/** The currency just before the number, allowing one space. Looks back a few characters, never at the whole line. */
const currencyBefore = (text: string, at: number): string | undefined => {
  const end = isGap(text[at - 1]) ? at - 1 : at;
  return CURRENCIES.find((currency) => text.startsWith(currency, end - currency.length));
};

const quantities = (text: string): Mention[] =>
  [...text.matchAll(NUMBER_RUN)].flatMap((match) => {
    const digits = withoutTrailingPunctuation(match[0]);
    const value = Number(digits.replace(/,/gu, ""));
    const end = match.index + digits.length;
    const unit = unitAfter(text, end) ?? currencyBefore(text, match.index);
    return unit === undefined || Number.isNaN(value) || isWordChar(text[match.index - 1]) ? [] : [{ start: match.index, end, attrs: { value, unit } }];
  });

/** "2.5 days" and "1.5 times" are amounts, not section 2.5 titled "days". */
const countedAfter = (_number: string, rest: string): boolean => unitAfter(` ${rest}`, 0) !== undefined;

export const structure: StructurePatterns = {
  numbered,
  definitions,
  references,
  obligations,
  quantities,
  dates,
  countedAfter,
  opensDefinitionScope,
  definitionScopeDepth,
};
