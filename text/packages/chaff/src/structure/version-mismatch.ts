// A version written in the lead-in to a code block ("Install version 2.3.0 from npm:") that the block itself does not
// show (npm install tidyq@2.4.0). Pure: reads the source, the code blocks, and the prose with code covered.
import type { Span } from "../plugin.ts";
import type { StructureIssue } from "./issues.ts";

/**
 * A dotted version of three parts (2.4.0, v1.12.3, 3.0.0-beta.2). Two parts (22.04, 3.1) are too often a decimal, and a
 * first part of four digits is too often a date (2024.01.15).
 */
const VERSION = /(?<![\w.])v?(\d{1,3}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.]+)?)(?![\w.]|\.\d)/gu;

/** A word that makes a version a bound or a starting point, not the version installed: 「2.3.0 から」 "from 2.3.0", "20.0.0 or later". */
export type RangeWord = { readonly word: string; readonly position: "before" | "after" };

/** What tells which versions are the block's: the bound words, and the Latin words that lead to the version installed. */
export type VersionWords = { readonly ranges: readonly RangeWord[]; readonly versionWords: readonly string[] };

/** One code block: where it starts and the text between its fences. */
export type CodeBlock = { readonly start: number; readonly code: string };

/** How far a range word may stand from the version (a space, a "v"). */
const RANGE_GAP = 2;

type Found = { readonly start: number; readonly end: number; readonly version: string };

const versionsIn = (text: string, offset = 0): Found[] =>
  [...text.matchAll(VERSION)].map((match) => ({ start: offset + match.index, end: offset + match.index + match[0].length, version: match[1] ?? "" }));

const isBound = (prose: string, found: Span, words: readonly RangeWord[]): boolean =>
  words.some(({ word, position }) => {
    if (word === "") return false;
    const near =
      position === "after"
        ? prose.slice(found.end, found.end + RANGE_GAP + word.length)
        : prose.slice(Math.max(0, found.start - RANGE_GAP - word.length), found.start);
    return near.toLowerCase().includes(word.toLowerCase());
  });

/** The names a block pins its version to: tidyq in tidyq@2.4.0, tidyq==2.4.0, tidyq=2.4.0, tidyq:2.4.0, "tidyq": "2.4.0". */
const PINNED = /^([\w.-]+)(?:@|==|=|:)[v^~]?\d/u;
const QUOTES = /["']/gu;
const OPENS_WITH_NUMBER = /^[v^~]?\d/u;

/** Each whitespace-separated word of the code, quotes dropped; "tidyq": "2.4.0" is read as tidyq:2.4.0. */
const codeWords = (code: string): string[] => {
  const words = code.split(/\s+/u).map((word) => word.replaceAll(QUOTES, "").replace(/,$/u, ""));
  return words.map((word, index) => (word.endsWith(":") && OPENS_WITH_NUMBER.test(words[index + 1] ?? "") ? `${word}${words[index + 1] ?? ""}` : word));
};

const pinnedNames = (code: string): Set<string> => new Set(codeWords(code).flatMap((word) => PINNED.exec(word)?.[1]?.toLowerCase() ?? []));

const LATIN = /^[A-Za-z]/u;
const WORD_CHAR = /[\w.+-]/u;
/** How far back the word before a version is looked for. */
const WORD_REACH = 40;

/** The Latin word right before a position, if the word there is Latin: "Node.js" in "Requires Node.js 18.17.0". */
const latinWordBefore = (text: string): string | undefined => {
  const last = [...(text.trimEnd().split(/\s/u).at(-1) ?? "")];
  const word = last.slice(0, last.findLastIndex((char) => WORD_CHAR.test(char)) + 1).join("");
  return LATIN.test(word) ? word.toLowerCase() : undefined;
};

/**
 * Whether a lead-in version is about the block's software. A Latin word right before it must be one of the words that lead
 * to the version installed (version, release, install; lexicon version-lead) or the pinned software: "Requires Node.js
 * 18.17.0" over `npm install pkg@2.4.0` names another program. A version after no Latin word (「npm から 2.3.0」) is the block's.
 */
const isAboutBlock = (prose: string, found: Found, names: ReadonlySet<string>, versionWords: readonly string[]): boolean => {
  const word = latinWordBefore(prose.slice(Math.max(0, found.start - WORD_REACH), found.start));
  return word === undefined || names.has(word) || versionWords.some((name) => name.toLowerCase() === word);
};

const BLANK_LINE = /\r?\n[ \t]*\r?\n/gu;
const NOT_PROSE = /^\s*(?:#|[-*+]\s|\d{1,3}[.)]\s|```|~~~|\|)/u;
const LETTER = /\p{L}/u;

/** The paragraph right above a code block: the lines up to the blank line before it. A heading, a list item, a table or a bare version above is not a lead-in. */
const leadInOf = (source: string, blockStart: number): Span | undefined => {
  const lines = source.slice(0, blockStart).trimEnd();
  const last = [...lines.matchAll(BLANK_LINE)].at(-1);
  const start = last === undefined ? 0 : last.index + last[0].length;
  const text = lines.slice(start);
  const words = text.replace(VERSION, "");
  return text === "" || NOT_PROSE.test(text) || !LETTER.test(words) ? undefined : { start, end: lines.length };
};

/**
 * Each version in a code block's lead-in that differs from the one version the block shows. A block with no version, or
 * with two (an upgrade from one to the other), says nothing to compare; a version marked as a bound, or named after another
 * program, is not the one installed.
 */
export const versionMismatches = (source: string, prose: string, blocks: readonly CodeBlock[], words: VersionWords): StructureIssue[] =>
  blocks.flatMap((block) => {
    const shown = [...new Set(versionsIn(block.code).map((found) => found.version))];
    const leadIn = leadInOf(source, block.start);
    const [code] = shown;
    if (shown.length !== 1 || code === undefined || leadIn === undefined) return [];
    const names = pinnedNames(block.code);
    return versionsIn(prose.slice(leadIn.start, leadIn.end), leadIn.start)
      .filter((found) => found.version !== code && !isBound(prose, found, words.ranges) && isAboutBlock(prose, found, names, words.versionWords))
      .map((found) => ({ offset: found.start, values: { written: found.version, code } }));
  });
