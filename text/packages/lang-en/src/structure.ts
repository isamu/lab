import type { Mention, NumberedLine, NumberingContext, StructurePatterns } from "chaffjs/plugin";

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

const headed = (pattern: RegExp, line: string, label: (n: string) => string): NumberedLine | undefined => {
  const groups = pattern.exec(line)?.groups;
  const number = numberOf(groups?.["n"]);
  const heading = titleOf(groups?.["rest"] ?? "");
  if (groups === undefined || number === undefined || heading === undefined) return undefined;
  return { kind: "article", depth: number.split(".").length, number, absolute: true, label: label(groups["n"] ?? ""), heading, rest: heading };
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

const lettered = (line: string, context: NumberingContext): NumberedLine | undefined => {
  const groups = LETTERED.exec(line)?.groups;
  const raw = groups?.["n"];
  if (groups === undefined || raw === undefined) return undefined;
  // 番地は書かれたままの "ii" を使う。参照「Section 4.2(a)(ii)」も同じ形で書かれるので、そのまま引ける。
  return {
    kind: "item",
    depth: depthFor(styleOf(raw, context), context),
    number: raw,
    absolute: false,
    label: `(${raw})`,
    heading: "",
    rest: groups["rest"]?.trim() ?? "",
  };
};

const numbered = (line: string, context: NumberingContext): NumberedLine | undefined =>
  headed(ARTICLE, line, (n) => `Article ${n}`) ?? headed(SECTION, line, (n) => `Section ${n}`) ?? lettered(line, context);

const mentions = (
  pattern: RegExp,
  text: string,
  attrs: (groups: Readonly<Record<string, string | undefined>>, whole: string) => Mention["attrs"] | undefined,
): Mention[] =>
  [...text.matchAll(pattern)].flatMap((match) => {
    const found = attrs(match.groups ?? {}, match[0]);
    return found === undefined ? [] : [{ start: match.index, end: match.index + match[0].length, attrs: found }];
  });

const DEFINITIONS = [
  /["“](?<term>[^"”\n]{1,60})["”] (?:means|shall mean|refers to|has the meaning)\b/gu,
  /\((?:the |hereinafter )?["“](?<term>[^"”\n]{1,60})["”]\)/gu,
  /\(hereinafter referred to as ["“](?<term>[^"”\n]{1,60})["”]\)/gu,
];

const definitions = (text: string): Mention[] =>
  DEFINITIONS.flatMap((pattern) => mentions(pattern, text, (groups) => (groups["term"] === undefined ? undefined : { term: groups["term"] })));

const REFERENCE = /\b(?:Sections?|Articles?|§) ?(?<n>\d{1,3}(?:\.\d{1,3}){0,5}|[IVXLC]{1,7})\b/gu;
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

/** "Section 4.2(a)" → 4.2.a, "Article III" → 3. The same addresses the tree gives. */
const references = (text: string): Mention[] =>
  [...text.matchAll(REFERENCE)].flatMap((match) => {
    const main = numberOf(match.groups?.["n"]);
    if (main === undefined) return [];
    const { parts, end } = subdivisions(text, match.index + match[0].length);
    return [{ start: match.index, end, attrs: { target: [main, ...parts].join("."), label: text.slice(match.index, end) } }];
  });

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
  "%",
];
const CURRENCIES = ["USD", "EUR", "$", "€", "£"];

/** "30." の終わりの点は文の終わり。数の一部にしない。 */
const withoutTrailingPunctuation = (run: string): string => {
  let end = run.length;
  while (end > 0 && (run[end - 1] === "." || run[end - 1] === ",")) end -= 1;
  return run.slice(0, end);
};

const unitAfter = (text: string, from: number): string | undefined => {
  const gap = text[from] === " " ? 1 : 0;
  const unit = UNITS.find((candidate) => text.startsWith(candidate, from + gap) && !isWordChar(text[from + gap + candidate.length]));
  return unit;
};

const currencyBefore = (text: string, at: number): string | undefined => CURRENCIES.find((currency) => text.slice(0, at).trimEnd().endsWith(currency));

const quantities = (text: string): Mention[] =>
  [...text.matchAll(NUMBER_RUN)].flatMap((match) => {
    const digits = withoutTrailingPunctuation(match[0]);
    const value = Number(digits.replace(/,/gu, ""));
    const end = match.index + digits.length;
    const unit = unitAfter(text, end) ?? currencyBefore(text, match.index);
    return unit === undefined || Number.isNaN(value) || isWordChar(text[match.index - 1]) ? [] : [{ start: match.index, end, attrs: { value, unit } }];
  });

export const structure: StructurePatterns = { numbered, definitions, references, obligations, quantities };
