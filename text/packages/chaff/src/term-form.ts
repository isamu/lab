import type { Span } from "./plugin.ts";
import { escapeRegExp, HYPHEN_CHARS } from "./orthography.ts";

// The team's terms written exactly so (chaff.yaml terms: GitHub, JavaScript). A variant is the same term once case,
// width (ＧｉｔＨｕｂ, ｶﾞ), hyphens and spaces are set aside: Github, ＧｉｔＨｕｂ, Java Script, Java-Script. Pure.

/** What a variant may add or drop: spaces of any width and the hyphens orthography.ts reads. */
const SEPARATOR = new RegExp(`[\\s${HYPHEN_CHARS}‒–—]`, "u");

/** A character as the comparison sees it: compatibility-decomposed (full width to half, ｶﾞ to カ and its mark) and lower case. */
const foldChar = (char: string): string => (SEPARATOR.test(char) ? "" : char.normalize("NFKD").toLowerCase());

/** The term as the comparison sees it. Empty when it is only spaces and hyphens. */
export const foldTerm = (term: string): string => Array.from(term, foldChar).join("");

/** The folded text, with the span of the original text each folded code unit comes from. */
type Folded = { readonly text: string; readonly origins: readonly Span[] };

type Piece = { readonly folded: string; readonly span: Span };

const piecesOf = (text: string): Piece[] =>
  Array.from(text).reduce<{ at: number; readonly pieces: Piece[] }>(
    (acc, char) => {
      acc.pieces.push({ folded: foldChar(char), span: { start: acc.at, end: acc.at + char.length } });
      acc.at += char.length;
      return acc;
    },
    { at: 0, pieces: [] },
  ).pieces;

const foldText = (text: string): Folded => {
  const pieces = piecesOf(text);
  return {
    text: pieces.map((piece) => piece.folded).join(""),
    origins: pieces.flatMap((piece) => Array.from({ length: piece.folded.length }, () => piece.span)),
  };
};

/** A Latin letter or digit: a term that starts or ends with one is a word, and a match inside a longer word is not the term. */
const WORD_CHAR = /[\p{Script=Latin}\p{N}_]/u;

/** A run of printable ASCII without brackets, as an address or a path is written (…/github.com/… で). */
const ASCII_RUN = /[!-'*-~]+/gu;
/** What marks a run as a URL, an address or a path rather than a word: a slash, a backslash, an @, or a dot before a letter (github.com, README.md). */
const ADDRESS_MARK = /[/\\@]|\.[\p{L}\p{N}]/u;

/** The ASCII run around the span, without the span. A match whose run is a URL, an address or a path is not prose. */
const isInAddress = (text: string, span: Span): boolean =>
  [...text.matchAll(ASCII_RUN)].some((run) => {
    const end = run.index + run[0].length;
    if (run.index > span.start || span.end > end) return false;
    return ADDRESS_MARK.test(text.slice(run.index, span.start)) || ADDRESS_MARK.test(text.slice(span.end, end));
  });

const isWordEdge = (text: string, span: Span, term: string): boolean => {
  const before = WORD_CHAR.test(term.charAt(0)) && WORD_CHAR.test(text.charAt(span.start - 1));
  const after = WORD_CHAR.test(term.charAt(term.length - 1)) && WORD_CHAR.test(text.charAt(span.end));
  return !before && !after;
};

/** The same term written as listed. Spaces count only as spaces: a line break inside "Claude Code" is the listed form. */
const isListedForm = (written: string, term: string): boolean => written.replace(/\s+/gu, " ") === term.replace(/\s+/gu, " ");

export type TermVariant = { readonly span: Span; readonly written: string; readonly term: string };

/** Where the folded term is found in the folded text, as spans of the original text. A match that starts or ends inside one character's folding is not one. */
const spansOf = (folded: Folded, foldedTerm: string): Span[] =>
  [...folded.text.matchAll(new RegExp(escapeRegExp(foldedTerm), "gu"))].flatMap((match) => {
    const first = folded.origins[match.index];
    const last = folded.origins[match.index + foldedTerm.length - 1];
    const splitsBefore = folded.origins[match.index - 1] === first;
    const splitsAfter = folded.origins[match.index + foldedTerm.length] === last;
    return first === undefined || last === undefined || splitsBefore || splitsAfter ? [] : [{ start: first.start, end: last.end }];
  });

const variantsOfTerm = (text: string, folded: Folded, term: string): TermVariant[] => {
  const foldedTerm = foldTerm(term);
  if (foldedTerm === "") return [];
  return spansOf(folded, foldedTerm)
    .filter((span) => isWordEdge(text, span, term) && !isInAddress(text, span))
    .map((span) => ({ span, written: text.slice(span.start, span.end), term }));
};

const isInsideLonger = (variant: TermVariant, other: TermVariant): boolean =>
  other.span.end - other.span.start > variant.span.end - variant.span.start && other.span.start <= variant.span.start && variant.span.end <= other.span.end;

/**
 * Every place in the text where a listed term is written in another form, in order. A place that one term covers and a
 * longer one covers too (Claude inside Claude Code) belongs to the longer: the shorter is part of it. A place written as
 * the longer term listed hides the shorter's variant inside it too. A place written as any listed term is not a variant.
 */
export const termVariants = (text: string, terms: readonly string[]): TermVariant[] => {
  const folded = foldText(text);
  const found = terms.flatMap((term) => variantsOfTerm(text, folded, term));
  return found
    .filter((variant) => !found.some((other) => isInsideLonger(variant, other)))
    .filter((variant) => !terms.some((term) => isListedForm(variant.written, term)))
    .toSorted((left, right) => left.span.start - right.span.start);
};
