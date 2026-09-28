import type { Mention, NumberedLine, NumberingContext, StructurePatterns } from "chaffjs/plugin";
import { citedDocumentAfter, listMembers } from "./citation.ts";

// Contracts, specifications and statutes in English. core nests what this reads; it does not know
// how English numbers its articles.

const ROMAN: Readonly<Record<string, number>> = { i: 1, v: 5, x: 10, l: 50, c: 100 };

/** "IV" → 4, "xii" → 12. Undefined for anything that is not a roman numeral. */
export const parseRoman = (text: string): number | undefined => {
  const values = [...text.toLowerCase()].map((char) => ROMAN[char]);
  if (values.length === 0 || values.some((value) => value === undefined)) return undefined;
  const known = values.filter((value) => value !== undefined);
  return known.reduce((total, value, index) => ((known[index + 1] ?? 0) > value ? total - value : total + value), 0);
};

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
const LETTERED = /^\s{0,6}\((?<n>[a-z]{1,4}|\d{1,3})\)\s+(?<rest>\S.*)$/u;
const MULTI_ROMAN = /^(?:ii|iii|iv|vi|vii|viii|ix)$/u;

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

type Style = "letter" | "roman" | "digit";

/**
 * 開いている項目の書き方。"(ii)" はローマ数字、"(b)" は英字。一文字の "(i)" はどちらにも読めるので、
 * 開いたときの読みを覚えておく代わりに、一つ上に英字が開いていたかで決め直す。
 */
const styleOfLabel = (open: NumberedLine, index: number, all: readonly NumberedLine[]): Style | undefined => {
  const inner = /^\((?<n>[a-z0-9]{1,4})\)$/u.exec(open.label)?.groups?.["n"];
  if (inner === undefined) return undefined;
  if (/^\d+$/u.test(inner)) return "digit";
  if (MULTI_ROMAN.test(inner)) return "roman";
  const above = all[index - 1];
  return /^[ivx]$/u.test(inner) && above !== undefined && styleOfLabel(above, index - 1, all) === "letter" && above.depth < open.depth ? "roman" : "letter";
};

const styles = (context: NumberingContext): (Style | undefined)[] => context.open.map((open, index, all) => styleOfLabel(open, index, all));

/** "(h)" の次の "(i)" は英字。開いている英字の次の文字なら、ローマ数字とは読まない。 */
const followsLetter = (raw: string, context: NumberingContext): boolean =>
  context.open.some((open, index) => styles(context)[index] === "letter" && open.number.charCodeAt(0) + 1 === raw.charCodeAt(0));

/** "(i)" is a roman numeral right under "(a)", or when a roman list is already open; the letter i otherwise. */
const styleOf = (raw: string, context: NumberingContext): Style => {
  if (/^\d+$/u.test(raw)) return "digit";
  if (MULTI_ROMAN.test(raw)) return "roman";
  if (!/^[ivx]$/u.test(raw) || followsLetter(raw, context)) return "letter";
  const open = styles(context);
  return open.includes("roman") || open.at(-1) === "letter" ? "roman" : "letter";
};

/**
 * A sibling has the depth of the open item written the same way: "(b)" closes "(i)" and sits beside "(a)".
 * A new way of numbering goes one deeper than whatever is open.
 */
const depthFor = (style: Style, context: NumberingContext): number => {
  const open = styles(context);
  const sibling = [...context.open].reverse().find((_item, reversed) => open[context.open.length - 1 - reversed] === style);
  return sibling?.depth ?? (context.open.at(-1)?.depth ?? 0) + 1;
};

const LETTER_BEFORE_A = "a".charCodeAt(0) - 1;

/** "(b)" は 2 番目、"(ii)" も 2 番目。二文字以上の英字（"(aa)"）は並びが決まらないので付けない。 */
const ordinalOf = (raw: string, style: Style): number | undefined => {
  if (style === "digit") return Number(raw);
  if (style === "roman") return parseRoman(raw);
  return raw.length === 1 ? raw.charCodeAt(0) - LETTER_BEFORE_A : undefined;
};

const lettered = (line: string, context: NumberingContext): NumberedLine | undefined => {
  const groups = LETTERED.exec(line)?.groups;
  const raw = groups?.["n"];
  if (groups === undefined || raw === undefined) return undefined;
  const style = styleOf(raw, context);
  // 番地は書かれたままの "ii" を使う。参照「Section 4.2(a)(ii)」も同じ形で書かれるので、そのまま引ける。
  return {
    kind: "item",
    depth: depthFor(style, context),
    ordinal: ordinalOf(raw, style),
    number: raw,
    absolute: false,
    label: `(${raw})`,
    heading: "",
    rest: groups["rest"]?.trim() ?? "",
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
  chapter(PART, line, -2, "pt", "Part") ??
  chapter(CHAPTER, line, -1, "ch", "Chapter") ??
  headed(ARTICLE, line, "article", (n) => `Article ${n}`) ??
  headed(SECTION, line, "section", (n) => `Section ${n}`) ??
  lettered(line, context);

const DEFINITIONS = [
  /["“](?<term>[^"”\n]{1,60})["”] (?:means|shall mean|refers to|has the meaning)\b/gu,
  /\((?:the |hereinafter )?["“](?<term>[^"”\n]{1,60})["”]\)/gu,
  /\(hereinafter referred to as ["“](?<term>[^"”\n]{1,60})["”]\)/gu,
];

/**
 * "In this Part—" and "This section applies where a person ("the seller")…": a statute defines the same word again
 * in the next Part. Read as the enclosing section, which is narrower than a Part: a repeat inside one Part goes unreported.
 */
const DEFINITION_SCOPE = /\b(?:In this (?:section|subsection|Part|Chapter|Schedule|Article)\b|This (?:section|Part|Chapter) defines\b)/u;
/** "This section applies where a person ("the seller") …" names a party in parentheses for this section only. */
const APPLIES = /\bThis section applies\b/u;
const opensDefinitionScope = (text: string): boolean => DEFINITION_SCOPE.test(text);

/** "has the meaning given in section 3" points at a definition elsewhere instead of making one. */
const POINTER = /^ has the meaning given (?:in|by)\b/u;
const isPointer = (text: string, end: number): boolean => POINTER.test(text.slice(end - " has the meaning".length));

const definitions = (text: string): Mention[] =>
  DEFINITIONS.flatMap((pattern) =>
    [...text.matchAll(pattern)].flatMap((match) => {
      const term = match.groups?.["term"];
      if (term === undefined) return [];
      const end = match.index + match[0].length;
      const namesAParty = match[0].startsWith("(") && APPLIES.test(text);
      return [{ start: match.index, end, attrs: { term, ...(isPointer(text, end) || namesAParty ? { scope: "local" } : {}) } }];
    }),
  );

const REFERENCE = /(?<word>\b[Ss]ections?|\b[Aa]rticles?|§) ?(?<n>\d{1,3}(?:\.\d{1,3}){0,5}|[IVXLC]{1,7})\b/gu;
const SUBDIVISION = /^\((?<p>[a-z0-9]{1,4})\)/u;

/** "(a)(ii)(3)" is as deep as a reference goes; more parentheses are text, not a deeper address. */
const MAX_SUBDIVISIONS = 4;

/**
 * "(a)(ii)" のような続きの括弧を、正規表現を複雑にせずに一つずつ読む。
 * 再帰にしないのは、括弧が延々と続く行でスタックを使い切らないため。
 */
const subdivisions = (text: string, from: number): { readonly parts: readonly string[]; readonly end: number } => {
  const parts: string[] = [];
  let end = from;
  while (parts.length < MAX_SUBDIVISIONS) {
    const part = SUBDIVISION.exec(text.slice(end, end + 6))?.groups?.["p"];
    if (part === undefined) break;
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
    const cited = citedDocumentAfter(text, end);
    const document = cited ?? glossedDocument(gloss);
    gloss.scanned = Math.max(gloss.scanned, end);
    if (cited !== undefined) gloss.anchors.push({ document: cited, depth: gloss.depth });
    const numbering = /^[Aa]/u.test(match.groups?.["word"] ?? "") ? "article" : "section";
    const shared = { numbering, ...(document === undefined ? {} : { document }) };
    const first = { start: match.index, end, attrs: { target: [main, ...parts].join("."), label: text.slice(match.index, end), ...shared } };
    return [first, ...membersAfter(text, end, [main, ...parts], shared)];
  });
};

const MEMBER = /^(?<main>\d{1,3}[A-Z]{0,2})?(?<parens>(?:\([a-z0-9]{1,4}\))*)$/u;

/**
 * "Sections 1, 2 and 9" → 2 and 9 as references too, with the list's numbering and document.
 * A member that is only parentheses stands at the same depth as the one before it: "Article 58(2)(c) to (g)" → 58.2.g.
 */
const membersAfter = (text: string, end: number, first: readonly string[], shared: Readonly<Record<string, string>>): Mention[] => {
  const mentions: Mention[] = [];
  listMembers(text.slice(end)).reduce<readonly string[] | undefined>((previous, member) => {
    const groups = MEMBER.exec(member.text)?.groups;
    const parens = [...(groups?.["parens"] ?? "").matchAll(/\(([a-z0-9]{1,4})\)/gu)].map((part) => part[1] ?? "");
    const main = groups?.["main"];
    const parts = main === undefined ? replaceLast(previous, parens) : [main, ...parens];
    if (parts === undefined) return undefined;
    const start = end + member.start;
    mentions.push({ start, end: start + member.text.length, attrs: { target: parts.join("."), label: member.text, ...shared } });
    return parts;
  }, first);
  return mentions;
};

/** The last parts of the address before, replaced by these: 58.2.c and (g) → 58.2.g. The main number stays. */
const replaceLast = (previous: readonly string[] | undefined, parens: readonly string[]): string[] | undefined =>
  previous === undefined || parens.length === 0 || previous.length <= parens.length
    ? undefined
    : [...previous.slice(0, previous.length - parens.length), ...parens];

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

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_WORD = /\b(?<month>[A-Z][a-z]{2,8})\b/gu;
const ISO_DATE = /\b(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})\b/gu;
const DAY_BEFORE = /(?<d>\d{1,2})(?:st|nd|rd|th)? $/u;
const DAY_YEAR_AFTER = /^ (?<d>\d{1,2})(?:st|nd|rd|th)?,? (?<y>\d{4})\b/u;
const YEAR_AFTER = /^,? (?<y>\d{4})\b/u;

const pad = (value: string): string => value.padStart(2, "0");

/** "1 April 2024": the day written before the month. */
const dayBefore = (text: string, at: number): { readonly day: string; readonly start: number } | undefined => {
  const found = DAY_BEFORE.exec(text.slice(Math.max(0, at - 6), at));
  const day = found?.groups?.["d"];
  return found === null || day === undefined ? undefined : { day, start: at - found[0].length };
};

/** "April 1, 2024" → 2024-04-01. */
const monthDayYear = (text: string, at: number, end: number, month: number): Mention | undefined => {
  const found = DAY_YEAR_AFTER.exec(text.slice(end, end + 16));
  if (found?.groups === undefined) return undefined;
  const value = `${found.groups["y"] ?? ""}-${pad(String(month))}-${pad(found.groups["d"] ?? "")}`;
  return { start: at, end: end + found[0].length, attrs: { value } };
};

/** "1 April 2024" → 2024-04-01, "April 2024" → 2024-04. */
const monthYear = (text: string, at: number, end: number, month: number): Mention | undefined => {
  const found = YEAR_AFTER.exec(text.slice(end, end + 8));
  const year = found?.groups?.["y"];
  if (found === null || year === undefined) return undefined;
  const before = dayBefore(text, at);
  const value = [year, pad(String(month)), ...(before === undefined ? [] : [pad(before.day)])].join("-");
  return { start: before?.start ?? at, end: end + found[0].length, attrs: { value } };
};

/**
 * A month name alone is not a date: "May" is also the modal verb, so it counts only with a year beside it.
 * The month is found first and its neighbours read with anchored patterns, never one long alternation.
 */
const namedDate = (text: string, match: RegExpExecArray): Mention | undefined => {
  const month = MONTHS.indexOf((match.groups?.["month"] ?? "").toLowerCase()) + 1;
  if (month === 0) return undefined;
  const end = match.index + match[0].length;
  return monthDayYear(text, match.index, end, month) ?? monthYear(text, match.index, end, month);
};

const isoDate = (match: RegExpExecArray): Mention => ({
  start: match.index,
  end: match.index + match[0].length,
  attrs: { value: `${match.groups?.["y"] ?? ""}-${match.groups?.["m"] ?? ""}-${match.groups?.["d"] ?? ""}` },
});

const dates = (text: string): Mention[] =>
  [...[...text.matchAll(MONTH_WORD)].flatMap((match) => namedDate(text, match) ?? []), ...[...text.matchAll(ISO_DATE)].map(isoDate)].sort(
    (left, right) => left.start - right.start,
  );

/** "2.5 days" and "1.5 times" are amounts, not section 2.5 titled "days". */
const countedAfter = (_number: string, rest: string): boolean => unitAfter(` ${rest}`, 0) !== undefined;

export const structure: StructurePatterns = { numbered, definitions, references, obligations, quantities, dates, countedAfter, opensDefinitionScope };
