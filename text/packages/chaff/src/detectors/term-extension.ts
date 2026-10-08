// A defined term written longer, with a word of its own definition added: 文書管理責任者 where 「管理責任者」とは、…文書の
// 管理の責任者をいう is defined, the Application where the Pinecone Notes application (the "App") is. The reader cannot tell
// whether the longer word is the defined thing or another one. Pure.
import { escapeRegExp } from "../orthography.ts";

/** The letters a Japanese compound is made of: a word written right before the term joins it into one longer word. */
const COMPOUND_CHAR = /[\p{Script=Han}\p{Script=Katakana}ー]/u;
const LATIN_LETTER = /\p{Script=Latin}/u;
const UPPER_START = /^\p{Lu}/u;
/** An added part shorter than this (書, the s of Services) is an ending or one character, not a word of the definition. */
const MIN_ADDED = 2;
/** A term shorter than this (提供, 登録) is an ordinary word that joins other words freely (情報提供, 利用登録). */
const MIN_COMPOUND_TERM = 3;
/** A plural ending (Boxes) is the same word, not a longer one. */
const PLURAL = /^e?s$/u;

/** The whole character that starts at, or ends right before, a position: both halves of 𠮷, not one. */
const charFrom = (source: string, at: number): string => String.fromCodePoint(source.codePointAt(at) ?? 0);
const charBefore = (source: string, at: number): string => {
  const low = source.charCodeAt(at - 1);
  const isLowHalf = low >= 0xdc00 && low <= 0xdfff && at >= 2;
  return isLowHalf ? source.slice(at - 2, at) : source.charAt(at - 1);
};

/** Where the run of compound characters that ends at offset starts. */
const runStart = (source: string, offset: number): number => {
  let start = offset;
  for (let char = charBefore(source, start); start > 0 && COMPOUND_CHAR.test(char); char = charBefore(source, start)) start -= char.length;
  return start;
};

/** The endings of a run, longest first, that are long enough to be a word added to the term. */
const endingsOf = (run: string): string[] => Array.from({ length: Math.max(0, run.length - MIN_ADDED + 1) }, (_, index) => run.slice(index));

/**
 * The term at offset written with more in front of it in one word (文書管理責任者), when what is in front ends with a word of
 * the definition (文書). A word that points at one of the defined things (当該管理責任者) does not lengthen it, and a longer
 * word the definition itself writes (東京都（以下「都」という。）) is the long name, not another form of the term.
 */
export const extendedBefore = (source: string, offset: number, term: string, definition: string, pointers: readonly string[] = []): string | undefined => {
  if ([...term].length < MIN_COMPOUND_TERM || COMPOUND_CHAR.test(charFrom(source, offset + term.length))) return undefined;
  const run = source.slice(runStart(source, offset), offset);
  const added = endingsOf(run).find((part) => definition.includes(part) && !pointers.some((pointer) => part.startsWith(pointer)));
  const written = added === undefined ? undefined : `${added}${term}`;
  return written === undefined || definition.includes(written) ? undefined : written;
};

/**
 * The capitalised term at offset written with more letters after it in one word (App → Application), when the definition
 * has that longer word (the Pinecone Notes application). A plural or a word joined to letters before it is not one.
 */
export const extendedAfter = (source: string, offset: number, term: string, definition: string): string | undefined => {
  if (!UPPER_START.test(term) || LATIN_LETTER.test(source.charAt(offset - 1))) return undefined;
  let end = offset + term.length;
  while (LATIN_LETTER.test(source.charAt(end))) end += 1;
  const added = source.slice(offset + term.length, end);
  if (added.length < MIN_ADDED || PLURAL.test(added)) return undefined;
  const word = source.slice(offset, end);
  return new RegExp(String.raw`(?<!\p{L})${escapeRegExp(word)}(?!\p{L})`, "iu").test(definition) ? word : undefined;
};

/** Each place the term is written exactly, in order. */
export const exactOffsets = (text: string, start: number, term: string): number[] => {
  const offsets: number[] = [];
  for (let at = text.indexOf(term); at !== -1 && term !== ""; at = text.indexOf(term, at + term.length)) offsets.push(start + at);
  return offsets;
};
