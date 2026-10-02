import type { Lexicon } from "../plugin.ts";

type Span = { readonly start: number; readonly end: number };

/** 雛形の空欄を囲む括弧。記号の形で、どの言語でも同じ。 */
const BRACKETED = /\[([^[\]\n]{1,60})\]|【([^【】\n]{1,30})】|［([^［］\n]{1,30})］/gu;

/** 書き手への指示を囲む丸括弧（（ここに会社名を書く））。丸括弧は説明にも使うので、語彙表の instruction の語で始まるときだけ数える。 */
const PARENTHESIZED = /\(([^()\n]{1,60})\)|（([^（）\n]{1,60})）/gu;

/**
 * 括弧のすぐ後ろ。Markdown のリンク（[text](url)、[text][ref]）と参照の定義（[ref]: url）、
 * 値が続く見出しの札（【氏名】山田、【日付】2024年）は空欄ではない。助詞（【会社名】の）や空白・句読点が続くなら空欄。
 */
const FILLED_AFTER = /^[([:：\p{Script=Han}\p{Script=Katakana}\p{Script=Latin}\p{N}]/u;

/** What may stand around a marker that is the whole value: quotes and brackets, a closing stop. */
const OPENING = /^[\s"'“‘「『(（[［【]*/u;
const CLOSERS: ReadonlySet<string> = new Set("\"'”’」』)）]］】.。!！");
const COLON_NEXT = /^\s*[:：]/u;

/** text without the quotes, brackets, stops and spaces that close it. */
const withoutClosers = (text: string): string => {
  const chars = [...text];
  const last = chars.findLastIndex((char) => !CLOSERS.has(char) && char.trim() !== "");
  return chars.slice(0, last + 1).join("");
};

/** Lexicon groups of placeholder-word. An entry without a group is a word written inside a template's brackets. */
const MARKER = "marker";
const INSTRUCTION = "instruction";

const innerOf = (match: RegExpExecArray): string => (match[1] ?? match[2] ?? match[3] ?? "").trim().toLowerCase();

/** 括弧の中身が語彙表の語そのものか、その語で始まって空白・アポストロフィが続くか（[Your Name]、[Insert Date]）。 */
const holdsWord = (inner: string, words: Lexicon): boolean =>
  words.some((word) => {
    const pattern = word.pattern.toLowerCase();
    return inner === pattern || (inner.startsWith(pattern) && /^[\s'’]/u.test(inner.slice(pattern.length)));
  });

/** 括弧の中身が指示の書き出しで始まるか（ここに会社名を書く）。 */
const opensWith = (inner: string, words: Lexicon): boolean => words.some((word) => inner.startsWith(word.pattern.toLowerCase()));

const spanOf = (match: RegExpExecArray): Span => ({ start: match.index, end: match.index + match[0].length });

const bracketedSpans = (text: string, pattern: RegExp, holds: (inner: string) => boolean): Span[] =>
  [...text.matchAll(pattern)].filter((match) => !FILLED_AFTER.test(text.slice(match.index + match[0].length)) && holds(innerOf(match))).map(spanOf);

/**
 * A value left as a marker: the whole text is the marker ("TBD", 「未定」), or the marker opens it before a colon
 * ("TBD: owner"), in any case. Only the start of a value counts, so a marker word inside a sentence is not one.
 * The span runs to the end of the value, quotes and the closing stop left out, so the finding quotes the whole note.
 * A checklist task ("[ ] TBD: …") and a comment ("// TBD") keep their mark in front, so the marker does not open them.
 */
const markerSpans = (text: string, markers: Lexicon): Span[] => {
  const start = OPENING.exec(text)?.[0].length ?? 0;
  const rest = text.slice(start);
  const marker = markers.find((entry) => rest.toLowerCase().startsWith(entry.pattern.toLowerCase()));
  if (marker === undefined) return [];
  const after = rest.slice(marker.pattern.length);
  if (withoutClosers(after) === "") return [{ start, end: start + marker.pattern.length }];
  if (!COLON_NEXT.test(after)) return [];
  return [{ start, end: start + withoutClosers(rest).length }];
};

/** Each line of a sentence on its own: values a line apart ("TBD: owner" then "TBD: date") are two blanks, not one. */
const lineMarkerSpans = (text: string, markers: Lexicon): Span[] =>
  text.split("\n").flatMap((line, index, lines) => {
    const offset = lines.slice(0, index).reduce((sum, previous) => sum + previous.length + 1, 0);
    return markerSpans(line, markers).map((span) => ({ start: span.start + offset, end: span.end + offset }));
  });

/** 文の中の、埋め忘れた雛形の空欄（[Your Name]、【会社名】、（ここに会社名を書く）、TBD: …）の範囲。words は placeholder-word の語彙表。 */
export const placeholderSpans = (text: string, words: Lexicon): Span[] => {
  const bracketWords = words.filter((word) => word.group === undefined);
  const instructions = words.filter((word) => word.group === INSTRUCTION);
  const markers = words.filter((word) => word.group === MARKER);
  return [
    ...bracketedSpans(text, BRACKETED, (inner) => holdsWord(inner, bracketWords)),
    ...(instructions.length === 0 ? [] : bracketedSpans(text, PARENTHESIZED, (inner) => opensWith(inner, instructions))),
    ...lineMarkerSpans(text, markers),
  ].toSorted((left, right) => left.start - right.start);
};
