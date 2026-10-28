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
  /** Words that end a longer name the run only starts (Federal Food, Drug, and Cosmetic Act). */
  readonly nameEnds: readonly string[];
  /** Company forms and places, which end a name right after a comma too (Post Holdings, Inc.; Canton, Ohio). */
  readonly formEnds: readonly string[];
  /** Words before the quoted label in brackets that define the run ((the "FDA")). */
  readonly definitionMarkers: readonly string[];
  /** Words opening brackets that say where the run is defined ((as defined in the Merger Agreement)). */
  readonly definedElsewhere: readonly string[];
  /** Words before a party's capacity after its name (Citibank, N.A., as Administrative Agent). */
  readonly capacityMarkers: readonly string[];
  /** Articles, which may stand between a capacity word and the capacity (as the Borrower). */
  readonly articles: readonly string[];
  /** Words right after a run that say it is attached (Termination Certificate attached hereto). */
  readonly attachedCues: readonly string[];
  /** Last words of a run that name a kind of document (Certificate, Form): with attachedCues after, the run is a title. */
  readonly attachedTitleEnds: readonly string[];
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

/** Whether two tokens are next to each other in a run: at most one character apart, or only spaces apart on one line (Normal Business       Hours). */
type Near = (left: Token, right: Token) => boolean;

const nearIn =
  (source: string): Near =>
  (left, right) =>
    adjacent(left, right) || /^[ \t]+$/u.test(source.slice(left.span.end, right.span.start));

/** How many tokens the capitalised run starting at index takes: words that continue it, and a joiner or hyphen between two. */
const runLength = (tokens: readonly Token[], index: number, joiners: ReadonlySet<string>, near: Near): number => {
  const word = tokens[index];
  const next = tokens[index + 1];
  const after = tokens[index + 2];
  if (next === undefined || word === undefined || !near(word, next)) return 1;
  if (continues(next)) return 1 + runLength(tokens, index + 1, joiners, near);
  const hyphened = next.surface === HYPHEN && touching(word, next) && after !== undefined && touching(next, after);
  const joined = hyphened || (joiners.has(next.surface) && after !== undefined && near(next, after));
  return joined && continues(after) ? 2 + runLength(tokens, index + 2, joiners, near) : 1;
};

type Run = { readonly start: number; readonly end: number };

/** The capitalised runs of one sentence, as [start, end) token indexes; a run never starts inside the one before. */
const runsOf = (tokens: readonly Token[], joiners: ReadonlySet<string>, near: Near): Run[] =>
  tokens.reduce<Run[]>((runs, token, index) => {
    if ((runs.at(-1)?.end ?? 0) > index || !isCapitalised(token)) return runs;
    return [...runs, { start: index, end: index + runLength(tokens, index, joiners, near) }];
  }, []);

/** Marks that glue a word to the next with no space (Borrowmoney.com, Leased/rent): one written form, not a term. */
const WORD_GLUE = new Set([".", "/"]);
const LETTER_START = /^\p{L}/u;

/**
 * The run is not written as a term: its last word is glued to more letters (a web address, a slash pair), or a small
 * word inside it is capitalised too (Maintenance And Deployment), which is capitalising every word, not naming a term.
 */
const notWrittenAsTerm = (tokens: readonly Token[], start: number, end: number, small: ReadonlySet<string>): boolean => {
  const last = tokens[end - 1];
  const glue = tokens[end];
  const more = tokens[end + 1];
  const glued = last !== undefined && glue !== undefined && more !== undefined && WORD_GLUE.has(glue.surface) && touching(last, glue) && touching(glue, more);
  if (glued && LETTER_START.test(more.surface)) return true;
  return tokens.slice(start + 1, end - 1).some((token) => isCapitalised(token) && small.has(token.surface.toLowerCase()));
};

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

/** How many tokens past a run a longer name may still end (’s Investors Service, Inc: five). */
const NAME_REACH = 8;
/** Marks inside one name: Post Holdings, Inc; Davis Polk & Wardwell LLP; Moody’s Investors Service. */
const NAME_GLUE = new Set([",", "&", ".", "'s", "’s"]);
const DIGIT_START = /^\d/u;

/** The last word of each name-ending entry (Kingdom of United Kingdom), without a closing full stop. */
const lastWordsOf = (entries: readonly string[]): Set<string> =>
  new Set(
    entries
      .flatMap((entry) =>
        entry
          .split(/[\s,]+/u)
          .filter((word) => word !== "")
          .slice(-1),
      )
      .map((word) => word.replace(/\.$/u, "")),
  );

/** Commas in a serial name's list (Federal Food, Drug, and Cosmetic Act). */
const SERIAL_COMMAS = 2;

type NameEnds = { readonly names: ReadonlySet<string>; readonly forms: ReadonlySet<string>; readonly formEntries: ReadonlySet<string> };

/**
 * Across a comma, a company form or a place ends the run's name only as the whole of what follows the comma (Post
 * Holdings, Inc; London, United Kingdom), and a name word only at the end of a serial list of two commas, the last
 * followed by a joiner (Federal Food, Drug, and Cosmetic Act): Confidential Information, Receiving Party and Servicer,
 * Navistar Securities Corporation are two things each.
 */
const endsName = (glued: readonly Token[], at: number, ends: NameEnds, joiners: ReadonlySet<string>): boolean => {
  const surface = glued[at]?.surface ?? "";
  const before = glued.slice(0, at);
  const surfaces = before.map((token) => token.surface);
  const comma = surfaces.lastIndexOf(",");
  if (comma === -1) return ends.forms.has(surface) || ends.names.has(surface);
  const afterComma = glued.slice(comma + 1, at + 1);
  if (ends.formEntries.has(afterComma.map((token) => token.surface).join(" "))) return true;
  const commas = surfaces.filter((each) => each === ",").length;
  return ends.names.has(surface) && commas >= SERIAL_COMMAS && joiners.has(afterComma[0]?.surface ?? "");
};

/** The run only starts a longer name: the words after it, joined by commas, ampersands and joiners, reach a word that ends a name. */
const startsLongerName = (tokens: readonly Token[], end: number, ends: NameEnds, joiners: ReadonlySet<string>): boolean => {
  const reach = tokens.slice(end, end + NAME_REACH);
  const stop = reach.findIndex((token, at) => {
    const before = tokens[end + at - 1];
    return before === undefined || !adjacent(before, token) || !(NAME_GLUE.has(token.surface) || joiners.has(token.surface) || continues(token));
  });
  const glued = reach.slice(0, stop === -1 ? reach.length : stop);
  return glued.some((_, at) => endsName(glued, at, ends, joiners));
};

/** A number right after the run makes it a numbered name (Proposition 65, Vaccines 2Go) or a contents line's page. */
const numberedName = (last: Token, after: Token | undefined): boolean => after !== undefined && adjacent(last, after) && DIGIT_START.test(after.surface);

/** The words as written and with their first letter capitalised (the, The), as one alternation. */
const alternativesOf = (words: readonly string[]): string =>
  words
    .filter((word) => word !== "")
    .flatMap((word) => [word, word.charAt(0).toUpperCase() + word.slice(1)])
    .map(escapeRegExp)
    .join("|");

/** A quoted label: a capitalised word or more in quotes, closing the brackets or followed by another label ("Buyer" or "PNC"). */
const QUOTED_LABEL = String.raw`["“]\p{Lu}[^"“”\n]{0,60}["”][ \t]*(?:\)|,|;|or[ \t]|and[ \t])`;

/**
 * Brackets right after a run that define it, so the run is what a definition names, not a term in use: a quoted label
 * (Food and Drug Administration (the "FDA"), Certificate of Analysis ("COA")) or a pointer to where it is defined
 * (Closing (as defined in the Merger Agreement)). A quoted phrase in lower case (("including records")) is no label.
 */
const definitionAfterPattern = (words: CapitalisedWords): RegExp => {
  const markers = alternativesOf(words.definitionMarkers);
  const elsewhere = alternativesOf(words.definedElsewhere);
  const label = markers === "" ? QUOTED_LABEL : String.raw`(?:(?:${markers})[ \t]+)*${QUOTED_LABEL}`;
  const opening = elsewhere === "" ? label : String.raw`(?:${label}|(?:${elsewhere})(?!\p{L}))`;
  return new RegExp(String.raw`^[ \t]*\([ \t]*${opening}`, "u");
};

/** How much text after a run the bracket check reads. */
const DEFINITION_AFTER_CHARS = 120;

/** The initials of a run's words, with and without its joiners (PFHOF and PFHF for Pro Football Hall of Fame). */
const initialsOf = (term: string, joiners: ReadonlySet<string>): string[] => {
  const words = term.split(/[\s-]+/u).filter((word) => word !== "");
  const initials = (kept: readonly string[]): string => kept.map((word) => word.charAt(0).toUpperCase()).join("");
  return words.length < 2 ? [] : [initials(words), initials(words.filter((word) => !joiners.has(word)))];
};

/**
 * The run names the capacity a named party acts in, in a list of parties to some agreement (Citibank, N.A., as
 * Administrative Agent; the Company, as the Borrower): the name, a comma, a capacity word and perhaps an article.
 */
const capacityOfAName = (tokens: readonly Token[], start: number, words: CapitalisedWords): boolean => {
  const before = tokens[start - 1];
  const at = before !== undefined && words.articles.includes(before.surface) ? start - 2 : start - 1;
  const marker = tokens[at];
  const comma = tokens[at - 1];
  const name = tokens[at - 2];
  if (marker === undefined || comma?.surface !== "," || name === undefined) return false;
  return words.capacityMarkers.includes(marker.surface) && (continues(name) || name.surface === ".");
};

/** Words right after a run that say it is attached (the Certificate attached hereto), ending at a word's edge. */
const attachedAfterPattern = (cues: readonly string[]): RegExp | undefined => {
  const words = cues.filter((cue) => cue !== "").map(escapeRegExp);
  return words.length === 0 ? undefined : new RegExp(String.raw`^[ \t]+(?:${words.join("|")})(?![\p{L}\p{N}_])`, "u");
};

/**
 * The run is the title of a document the agreement attaches: its last word names a kind of document (Certificate,
 * Form) and words right after it say it is attached. Confidential Information attached hereto is no title.
 */
const titlesAttachment = (words: CapitalisedWords): ((last: Token, after: string) => boolean) => {
  const attached = attachedAfterPattern(words.attachedCues);
  const titleEnds = new Set(words.attachedTitleEnds);
  return (last, after) => attached !== undefined && titleEnds.has(last.surface) && attached.test(after);
};

/**
 * Whether a run is a name by what surrounds it: a number after it, a longer name it starts, brackets after it that
 * define it, initials that spell a term the document defines (“IRS” means the Internal Revenue Service), a capacity, or
 * words that make it the title of an attached form.
 */
type NameCue = (tokens: readonly Token[], start: number, end: number, term: string) => boolean;

const nameCues = (input: CapitalisedInput, joiners: ReadonlySet<string>): NameCue => {
  const words = input.words;
  const ends = { names: lastWordsOf(words.nameEnds), forms: lastWordsOf(words.formEnds), formEntries: new Set(words.formEnds) };
  const definitionAfter = definitionAfterPattern(words);
  const attachedTitle = titlesAttachment(words);
  const abbreviations = new Set([...input.defined.map((definition) => definition.term), ...input.named].filter((term) => ACRONYM.test(term)));
  return (tokens, start, end, term) => {
    const last = tokens[end - 1];
    if (last === undefined) return false;
    const after = input.source.slice(last.span.end, last.span.end + DEFINITION_AFTER_CHARS);
    return (
      numberedName(last, tokens[end]) ||
      startsLongerName(tokens, end, ends, joiners) ||
      definitionAfter.test(after) ||
      attachedTitle(last, after) ||
      initialsOf(term, joiners).some((initials) => abbreviations.has(initials)) ||
      capacityOfAName(tokens, start, words)
    );
  };
};

/**
 * The first use of each capitalised run used inside a sentence like a defined term that names nothing the language
 * package lists, is not set apart by markup, is never written in lower case, and neither is nor holds a defined or named
 * term in any case. A run that starts a longer name, carries a number, or is defined by the brackets after it is a name.
 */
export const capitalisedTerms = (input: CapitalisedInput): CapitalisedTerm[] => {
  const defining = input.defined.filter((definition) => definition.bare !== true && DEFINED_FORM.test(definition.term));
  if (defining.length < MIN_DEFINED) return [];
  const joiners = new Set(input.words.joiners);
  const small = new Set([...input.words.joiners, ...input.words.articles].map((word) => word.toLowerCase()));
  const near = nearIn(input.source);
  const isName = nameCues(input, joiners);
  const divisions = new Set(input.words.divisions.flatMap(formsOf));
  const known = new Set([...input.defined.map((definition) => definition.term), ...input.named, ...input.words.names].flatMap(formsOf));
  const isKnown = (term: string): boolean => partsOf(term).some((part) => formsOf(part).some((form) => known.has(form)));
  const uses = input.sentences.flatMap((tokens) =>
    runsOf(tokens, joiners, near).flatMap(({ start, end }): CapitalisedTerm[] => {
      const first = tokens[start];
      const last = tokens[end - 1];
      if (first === undefined || last === undefined || !placedLikeATerm(tokens[start - 1], tokens[end])) return [];
      if (inside(first.span.start, input.marked) || formsOf(first.surface).some((form) => divisions.has(form))) return [];
      const term = input.source.slice(first.span.start, last.span.end);
      if (isKnown(term) || isName(tokens, start, end, term) || notWrittenAsTerm(tokens, start, end, small)) return [];
      return writtenInLowerCase(input.readable, term) ? [] : [{ offset: first.span.start, term }];
    }),
  );
  return uses.filter((use, index) => uses.findIndex((other) => formsOf(other.term).some((form) => formsOf(use.term).includes(form))) === index);
};

const BOLD = /\*\*([^*\n]+)\*\*|__([^_\n]+)__/gu;
const QUOTED = /["“]([^"“”\n]{1,80}?)[,.]?["”]/gu;
const HTML_ELEMENT = /<([a-z][a-z0-9]*)\b[^>]*>[^<]*<\/\1>/giu;
const TABLE_ROW = /^[ \t]*\|.*$/gmu;
const ITEM_LABEL = /^[ \t]*(?:[*+-]|\d+[.)])[ \t]+[^:\n]{1,80}:/gmu;
const CAPTION_WORD = String.raw`\p{Lu}[\p{L}'’-]*`;
const CAPTION_SMALL = String.raw`(?:of|and|or|to|the|for|with|in|on|a|an|by|from|under|upon|as|at|not)[ \t]+`;
/** A clause's run-in caption: its number, then capitalised words up to a full stop or colon (5.8 No Representation or Warranty.). */
const CAPTION = new RegExp(
  String.raw`(?:^|(?<=[.;:][ \t]+))[ \t]*(?:(?:Section|Article|SECTION|ARTICLE)[ \t]+)?(?:\d+(?:\.\d+)*\.?|\([a-z\d]{1,4}\))[ \t]+` +
    String.raw`${CAPTION_WORD}(?:(?:[ \t]+|[;,][ \t]*)(?:${CAPTION_SMALL})*${CAPTION_WORD}){0,10}(?=[.:](?:\s|$))`,
  "gmu",
);

const spansOf = (source: string, pattern: RegExp): Span[] =>
  [...source.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

/** Bold, HTML elements, table rows, list items' labels and clauses' run-in captions: labels and cells, not running text. */
export const setApartSpans = (source: string): Span[] => [BOLD, HTML_ELEMENT, TABLE_ROW, ITEM_LABEL, CAPTION].flatMap((pattern) => spansOf(source, pattern));

const LINK_DESTINATION = /\]\([^)\n]*\)|<?https?:\/\/[^\s)>]+>?/gu;

/** The source with link destinations and URLs blanked: the words a reader sees. */
export const readableText = (source: string): string => source.replaceAll(LINK_DESTINATION, (destination) => " ".repeat(destination.length));

/** The words set in quotes or bold anywhere in a source, without the emphasis marks. */
export const namedWords = (source: string): string[] =>
  [BOLD, QUOTED].flatMap((pattern) => [...source.matchAll(pattern)].map((match) => (match[1] ?? match[2] ?? "").replaceAll(/[*_]/gu, "").trim()));
