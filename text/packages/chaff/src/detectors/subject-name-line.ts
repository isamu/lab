// A line under a heading that gives the name of what the heading is about, not a sentence restating it: the label of a
// link or an attachment the heading introduces (### 実施要綱について → 実施要綱), or a list named after the heading
// (## 皆さんの声 → 「皆さんの声」一覧). A converted page keeps such labels as plain lines. Pure.
import { isContent } from "./content-morphemes.ts";
import type { Token } from "../plugin.ts";

/** A title is made of these: names, the words that build a name (annual, の, of, and), no predicate. */
const TITLE_POS: ReadonlySet<string> = new Set(["NOUN", "PROPN", "NUM", "PUNCT", "SYM", "X", "ADJ", "ADP", "DET", "CCONJ"]);
/** A line that ends like a sentence says something, whatever its words. */
const SENTENCE_END = /[。．.!?！？]$/u;

const isTitle = (tokens: readonly Token[]): boolean => tokens.some(isContent) && tokens.every((token) => TITLE_POS.has(token.pos));

const baseForm = (token: Token): string => (token.lemma ?? token.surface).toLowerCase();

/** Brackets a line quotes a title in. */
const QUOTES: readonly (readonly [string, string])[] = [
  ["「", "」"],
  ["『", "』"],
  ["“", "”"],
  ['"', '"'],
];

type Span = { readonly start: number; readonly end: number };

/** Where the line quotes the whole heading as a title, in the tokens' coordinates. */
const quotedHeading = (heading: string, line: string, lineStart: number): Span | undefined => {
  const quoted = QUOTES.map(([open, close]) => `${open}${heading}${close}`).find((form) => line.includes(form));
  if (quoted === undefined) return undefined;
  const start = lineStart + line.indexOf(quoted);
  return { start, end: start + quoted.length };
};

/** 「見出し」一覧: the heading quoted as a title, and only a name after it that says what the line is (一覧, page). */
const namesListAfterHeading = (outside: readonly Token[]): boolean => isTitle(outside);

/**
 * 実施要綱 under ### 実施要綱について: the line is a title, and what the heading has beyond it only frames the name (について,
 * About, 紹介). A line that copies the heading whole (### 研究科 → 研究科) is a repeat, and one that drops a word of the
 * heading's own (### 精算方法の概要 → 精算方法) does not name the heading's subject.
 */
const namesHeadingTopic = (heading: readonly Token[], line: readonly Token[], announcing: ReadonlySet<string>): boolean => {
  if (!isTitle(line)) return false;
  const named = new Set(line.map(baseForm));
  const beyond = heading.filter((token) => token.pos !== "PUNCT" && !named.has(baseForm(token)));
  return beyond.length > 0 && beyond.every((token) => !isContent(token) || announcing.has(baseForm(token)));
};

/**
 * The first line under a heading names what the heading is about. `heading` is the heading's text without its number
 * label, `headingTokens` its tokens; `lineTokens` are the line's, in the coordinates `lineStart` gives. `announcing`
 * holds the words that only frame a subject (the heading-announcer lexicon's ungrouped entries).
 */
export const namesHeadingSubject = (
  heading: string,
  headingTokens: readonly Token[],
  line: string,
  lineStart: number,
  lineTokens: readonly Token[],
  announcing: ReadonlySet<string>,
): boolean => {
  if (line.trim().includes("\n") || SENTENCE_END.test(line.trim()) || heading.trim() === "") return false;
  const quoted = quotedHeading(heading.trim(), line, lineStart);
  if (quoted !== undefined) return namesListAfterHeading(lineTokens.filter((token) => token.span.start < quoted.start || token.span.start >= quoted.end));
  return namesHeadingTopic(headingTokens, lineTokens, announcing);
};
