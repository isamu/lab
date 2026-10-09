// A term written like the document's defined terms, capitalised inside a sentence (its Affiliates, disclose Proprietary
// Data), that the document defines nowhere. Read only where the document defines its terms with a defining word
// (MIN_DEFINED of them: "X" means, (the "X")). A capitalised run is also the name of a law, a body, a place, a party or a
// part of the document, so every name the language package lists is left, and so is every run set apart by markup (a
// heading, a link, bold, an HTML element, a table row, a list item's label). Pure.
import { escapeRegExp } from "../orthography.ts";
import type { Span, Token } from "../plugin.ts";

export type CapitalisedTerm = { readonly offset: number; readonly term: string };

/** The word lists the decision reads, matched as written. */
export type CapitalisedWords = {
  /** A run holding one of these is a name (Act, Policy, Inc, California, Monday, Supplier), not a term. */
  readonly names: readonly string[];
  /** A run opening with one of these points at a part of the document (Section 4, Schedule A). */
  readonly divisions: readonly string[];
  /** Small words inside one name (Statement of Work, Trials and Betas). */
  readonly joiners: readonly string[];
};

/** A term the document defines; bare is a definition with no defining word (("GPC")), which names more than it defines. */
export type Defined = { readonly term: string; readonly bare?: boolean };

export type CapitalisedInput = {
  readonly source: string;
  /** The text a reader sees (the source without link destinations): where a lower-case use counts. */
  readonly readable: string;
  readonly sentences: readonly (readonly Token[])[];
  readonly defined: readonly Defined[];
  /** Words set in quotes or bold anywhere ("Account" represents …, **Security Measures**): named on purpose. */
  readonly named: readonly string[];
  /** Spans set apart by markup: headings, links, bold, HTML elements, table rows, list items' labels. */
  readonly marked: readonly Span[];
  readonly words: CapitalisedWords;
};

/** Fewer definitions than this, and capitals are the document's style, not its way of naming terms. */
const MIN_DEFINED = 2;
const CAPITALISED = /^\p{Lu}\p{Ll}+(?:['’]\p{Ll}+)?$/u;
const ACRONYM = /^\p{Lu}{2,}$/u;
const DEFINED_FORM = /^\p{Lu}/u;
const LOWER_WORD = /^\p{Ll}+$/u;
const HYPHEN = "-";

const isCapitalised = (token: Token | undefined): boolean => token !== undefined && CAPITALISED.test(token.surface);
/** A word that carries a run on once it has started: a capitalised word or an acronym (Commercial AI System). */
const continues = (token: Token | undefined): boolean => isCapitalised(token) || (token !== undefined && ACRONYM.test(token.surface));
const adjacent = (left: Token, right: Token): boolean => right.span.start - left.span.end <= 1;
const touching = (left: Token, right: Token): boolean => right.span.start === left.span.end;

/** The forms one term is written in: lower case, its last word as written and singular (Policies, Policy; Viruses, Virus). */
const formsOf = (term: string): string[] => {
  const words = term.toLowerCase().split(/[\s-]+/u);
  const head = words.slice(0, -1).join(" ");
  const last = words.at(-1) ?? "";
  const lasts = [last, last.replace(/ies$/u, "y"), last.replace(/es$/u, ""), last.replace(/(?<!s)s$/u, "")];
  return lasts.map((form) => (head === "" ? form : `${head} ${form}`));
};

/** How many tokens the capitalised run starting at index takes: words that continue it, and a joiner or hyphen between two. */
const runLength = (tokens: readonly Token[], index: number, joiners: ReadonlySet<string>): number => {
  const word = tokens[index];
  const next = tokens[index + 1];
  const after = tokens[index + 2];
  if (next === undefined || word === undefined || !adjacent(word, next)) return 1;
  if (continues(next)) return 1 + runLength(tokens, index + 1, joiners);
  const hyphened = next.surface === HYPHEN && touching(word, next) && after !== undefined && touching(next, after);
  const joined = hyphened || (joiners.has(next.surface) && after !== undefined && adjacent(next, after));
  return joined && continues(after) ? 2 + runLength(tokens, index + 2, joiners) : 1;
};

type Run = { readonly start: number; readonly end: number };

/** The capitalised runs of one sentence, as [start, end) token indexes; a run never starts inside the one before. */
const runsOf = (tokens: readonly Token[], joiners: ReadonlySet<string>): Run[] =>
  tokens.reduce<Run[]>((runs, token, index) => {
    if ((runs.at(-1)?.end ?? 0) > index || !isCapitalised(token)) return runs;
    return [...runs, { start: index, end: index + runLength(tokens, index, joiners) }];
  }, []);

const inside = (offset: number, spans: readonly Span[]): boolean => spans.some((span) => span.start <= offset && offset < span.end);

/** Used like a defined term: after a lower-case word, and not a modifier of a lower-case noun after it (the Premium plan). */
const placedLikeATerm = (before: Token | undefined, after: Token | undefined): boolean =>
  before !== undefined && LOWER_WORD.test(before.surface) && !(after !== undefined && after.pos === "NOUN" && LOWER_WORD.test(after.surface));

/** Every run of whole words in a term (GitHub Service: GitHub, Service, GitHub Service). */
const partsOf = (term: string): string[] => {
  const words = term.split(/\s+/u);
  return words.flatMap((_, start) => words.slice(start).map((__, length) => words.slice(start, start + length + 1).join(" ")));
};

/** The text also writes the term in lower case (your account, account settings): an ordinary word, or a screen's label. */
const writtenInLowerCase = (text: string, term: string): boolean => {
  const words = term
    .toLowerCase()
    .split(/[\s-]+/u)
    .map(escapeRegExp)
    .join(String.raw`[\s-]+`);
  return new RegExp(String.raw`(?<!\p{L})${words}(?:e?s)?(?!\p{L})`, "u").test(text);
};

/**
 * The first use of each capitalised run used inside a sentence like a defined term that names nothing the language
 * package lists, is not set apart by markup, is never written in lower case, and neither is nor holds a defined or named
 * term in any case.
 */
export const capitalisedTerms = (input: CapitalisedInput): CapitalisedTerm[] => {
  const defining = input.defined.filter((definition) => definition.bare !== true && DEFINED_FORM.test(definition.term));
  if (defining.length < MIN_DEFINED) return [];
  const joiners = new Set(input.words.joiners);
  const divisions = new Set(input.words.divisions.flatMap(formsOf));
  const known = new Set([...input.defined.map((definition) => definition.term), ...input.named, ...input.words.names].flatMap(formsOf));
  const isKnown = (term: string): boolean => partsOf(term).some((part) => formsOf(part).some((form) => known.has(form)));
  const uses = input.sentences.flatMap((tokens) =>
    runsOf(tokens, joiners).flatMap(({ start, end }): CapitalisedTerm[] => {
      const first = tokens[start];
      const last = tokens[end - 1];
      if (first === undefined || last === undefined || !placedLikeATerm(tokens[start - 1], tokens[end])) return [];
      if (inside(first.span.start, input.marked) || formsOf(first.surface).some((form) => divisions.has(form))) return [];
      const term = input.source.slice(first.span.start, last.span.end);
      return isKnown(term) || writtenInLowerCase(input.readable, term) ? [] : [{ offset: first.span.start, term }];
    }),
  );
  return uses.filter((use, index) => uses.findIndex((other) => formsOf(other.term).some((form) => formsOf(use.term).includes(form))) === index);
};

const BOLD = /\*\*([^*\n]+)\*\*|__([^_\n]+)__/gu;
const QUOTED = /["“]([^"“”\n]{1,80}?)[,.]?["”]/gu;
const HTML_ELEMENT = /<([a-z][a-z0-9]*)\b[^>]*>[^<]*<\/\1>/giu;
const TABLE_ROW = /^[ \t]*\|.*$/gmu;
const ITEM_LABEL = /^[ \t]*(?:[*+-]|\d+[.)])[ \t]+[^:\n]{1,80}:/gmu;

const spansOf = (source: string, pattern: RegExp): Span[] =>
  [...source.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

/** Bold, HTML elements, table rows and list items' labels in a Markdown source: labels and cells, not running text. */
export const setApartSpans = (source: string): Span[] => [BOLD, HTML_ELEMENT, TABLE_ROW, ITEM_LABEL].flatMap((pattern) => spansOf(source, pattern));

const LINK_DESTINATION = /\]\([^)\n]*\)|<?https?:\/\/[^\s)>]+>?/gu;

/** The source with link destinations and URLs blanked: the words a reader sees. */
export const readableText = (source: string): string => source.replaceAll(LINK_DESTINATION, (destination) => " ".repeat(destination.length));

/** The words set in quotes or bold anywhere in a source, without the emphasis marks. */
export const namedWords = (source: string): string[] =>
  [BOLD, QUOTED].flatMap((pattern) => [...source.matchAll(pattern)].map((match) => (match[1] ?? match[2] ?? "").replaceAll(/[*_]/gu, "").trim()));
