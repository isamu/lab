// A footnote that opens with a citation signal and cites, with nothing of the writer's after the signal: a legal citation
// (See, e.g., 12 C.F.R. §§ 5.34(e)(3) …) or titles of other documents joined by semicolons (See A Title; FDIC: Another Title).
// Its length is the length of the references. Pure.
import { escapeRegExp } from "../orthography.ts";
import { isTitleCase } from "./sentence-title.ts";

/** The section sign marks a citation of a code or a regulation in any language. */
const SECTION_SIGN = /§/u;
/** A citation string cites more than one source (a semicolon between them) or dates what it cites ((Apr. 28, 2005)). */
const CITATION_DETAIL = /;|\([^()]*\d{4}\)/u;
const SEGMENT_SEPARATOR = /;/u;
const MIN_TITLES = 2;
/** "See, e.g.," and "See also, e.g.,": the example signal after the signal. */
const EXAMPLE_SIGNAL = String.raw`(?:,?\s*e\.g\.,)?`;

/** What follows a signal at the very start of the text, or undefined when the text does not open with one. */
const afterOpeningSignal = (text: string, signals: readonly string[]): string | undefined => {
  if (signals.length === 0) return undefined;
  const alternatives = [...signals]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  const opening = new RegExp(String.raw`^(?:${alternatives})${EXAMPLE_SIGNAL}(?![\p{L}\p{N}])`, "iu").exec(text.trim());
  return opening === null ? undefined : text.trim().slice(opening[0].length);
};

const isTitleSeries = (cited: string): boolean => {
  const segments = cited.split(SEGMENT_SEPARATOR).filter((segment) => segment.trim() !== "");
  return segments.length >= MIN_TITLES && segments.every(isTitleCase);
};

/** Whether the text is a citation string: a signal first, then a legal citation or a series of titles. */
export const isCitationString = (text: string, signals: readonly string[]): boolean => {
  const cited = afterOpeningSignal(text, signals);
  return cited !== undefined && ((SECTION_SIGN.test(cited) && CITATION_DETAIL.test(cited)) || isTitleSeries(cited));
};

/** A quoted title (“Frequently Asked Questions …,”), cited as it is published. */
const QUOTED_TITLE = /“[^“”]*”|"[^"]*"/gu;
const PARENTHESIS = /\(([^()]*)\)/gu;
const PARENTHESIS_WORD_BREAK = /[\s,]+/u;
const STARTS_CAPITAL_OR_DIGIT = /^[\p{Lu}\p{N}]/u;
/** A capitalised word or a number, as the words of a cited name are written (Act, 2001, U.S., Questions:). */
const NAME_WORD = /^(?:\p{Lu}[\p{L}\p{N}.'’&-]*:?|\p{N}[\p{N}.-]*)$/u;
/** Short words a name keeps in lower case between its capitalised words (Act of 2001, Tools Required to Intercept). */
const NAME_JOINERS: ReadonlySet<string> = new Set(["of", "and", "the", "for", "to", "by", "in", "on", "at", "with", "or", "from", "a", "an"]);
const CAPITALISED = /^\p{Lu}/u;
/** Fewer capitalised words than this are the writer's own (the CIP Rule), not the name of a cited document or body. */
const MIN_NAME_WORDS = 3;

/** A parenthesis of names, codes and dates only ((FEMA), (DR 4339), (January 18, 2023)): every word in it starts with a capital or a digit. */
const isNameParenthesis = (inside: string): boolean => {
  const words = inside.split(PARENTHESIS_WORD_BREAK).filter((word) => word !== "");
  return words.length > 0 && words.every((word) => STARTS_CAPITAL_OR_DIGIT.test(word));
};

/** The words in runs: a run is name words, with joiners only between two of them. */
type Runs = { readonly runs: string[][]; readonly joiners: string[] };

const addWord = (state: Runs, word: string): Runs => {
  const current = state.runs.at(-1);
  if (NAME_WORD.test(word)) {
    if (current !== undefined && current.length > 0 && NAME_WORD.test(current.at(-1) ?? "")) current.push(...state.joiners, word);
    else state.runs.push(...(state.joiners.length > 0 ? [state.joiners.slice()] : []), [word]);
    return { runs: state.runs, joiners: [] };
  }
  if (NAME_JOINERS.has(word) && current !== undefined && NAME_WORD.test(current.at(-1) ?? "")) return { runs: state.runs, joiners: [...state.joiners, word] };
  state.runs.push([...state.joiners, word]);
  return { runs: state.runs, joiners: [] };
};

const isCitedName = (run: readonly string[]): boolean => NAME_WORD.test(run[0] ?? "") && run.filter((word) => CAPITALISED.test(word)).length >= MIN_NAME_WORDS;

/** The words left once every run of three capitalised words or more (Act of 2001, Hurricane Maria) is taken out. */
const withoutNames = (cited: string): string => {
  const { runs, joiners } = cited
    .split(/\s+/u)
    .filter((word) => word !== "")
    .reduce<Runs>(addWord, { runs: [], joiners: [] });
  return [...runs.filter((run) => !isCitedName(run)).flat(), ...joiners].join(" ");
};

/**
 * The writer's words in a footnote that opens with a citation signal: the signal and what is left once the cited names
 * (Uniting and Strengthening America … Act of 2001), quoted titles and parentheses of codes and dates are taken out
 * (See also SR letter 05-9, “…,” for interagency guidance on …). Undefined when the text does not open with a signal.
 */
export const wordsAroundCitation = (text: string, signals: readonly string[]): string | undefined => {
  const cited = afterOpeningSignal(text, signals);
  if (cited === undefined) return undefined;
  const signal = text.trim().slice(0, text.trim().length - cited.length);
  return `${signal} ${withoutNames(cited.replace(QUOTED_TITLE, " ").replace(PARENTHESIS, (whole, inside: string) => (isNameParenthesis(inside) ? " " : whole)))}`;
};
