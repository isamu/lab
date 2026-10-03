// A defined term used later in another form, and a long name used again after its short name was defined. Pure. The
// definitions come from the document's structure tree (以下「甲」という, ("Seller")); which words may stand in a long
// name is read from the tokens' parts of speech.
import { definedTerms, usesOf, type BodyText, type DefinedTerm } from "../structure/definition-use.ts";
import { escapeRegExp } from "../orthography.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding, ProseDocument, Sentence, Span, Token } from "../plugin.ts";

const bodyOf = (doc: ProseDocument): BodyText[] => doc.sentences.map((sentence) => ({ start: sentence.span.start, text: sentence.text }));

const finding = (doc: ProseDocument, rule: string, offset: number, variant: string, values: Readonly<Record<string, string | number>>): Finding => ({
  rule,
  severity: "info",
  line: 0,
  column: 0,
  quote: quoteAt(doc.source, offset),
  values: { ...values, offset },
  variant,
});

const OPENING_QUOTES = new Set(["「", "『", '"', "“"]);
const CLOSING_QUOTES = new Set(["」", "』", '"', "”"]);
/** A quoted term right before these is defined again (「X」とは, "X" means), which duplicate-definition reads. */
const DEFINING_AFTER = /^(?:とは|という|\s+(?:means|shall mean|refers to|has the meaning))/u;
/** The ending a use may carry past the term: a plural or a possessive (Services, Service's). */
const WORD_ENDING = /^(?:e?s|['’]s?)/u;

/** The first definition of each term, with the spans of all its definitions. */
const firstDefinitions = (terms: readonly DefinedTerm[]): { readonly term: DefinedTerm; readonly spans: readonly Span[] }[] => {
  const groups = new Map<string, { term: DefinedTerm; spans: Span[] }>();
  terms.forEach((term) => {
    const group = groups.get(term.term);
    if (group === undefined) groups.set(term.term, { term, spans: [term.span] });
    else group.spans.push(term.span);
  });
  return [...groups.values()];
};

/** A use of the term set in quotes again after its definition: 「本サービス」 where 本サービス was defined. */
export const quotedUses = (source: string, term: string, uses: readonly number[], definedAt: number): number[] =>
  uses.filter((offset) => {
    const after = offset + term.length + (WORD_ENDING.exec(source.slice(offset + term.length, offset + term.length + 2))?.[0].length ?? 0);
    return (
      offset > definedAt &&
      OPENING_QUOTES.has(source.charAt(offset - 1)) &&
      CLOSING_QUOTES.has(source.charAt(after)) &&
      !DEFINING_AFTER.test(source.slice(after + 1, after + 20))
    );
  });

const UPPER_START = /^\p{Lu}/u;

/**
 * The uses of a capitalised term written in lower case ("services" where "Services" is defined), when they are the fewer
 * and at most limit: a document that mostly writes it in lower case uses the word in its ordinary sense on purpose.
 */
export const lowerCaseUses = (source: string, term: string, uses: readonly number[], definedAt: number, limit: number): number[] => {
  if (!UPPER_START.test(term) || term.toLowerCase() === term) return [];
  const later = uses.filter((offset) => offset > definedAt);
  const lower = later.filter((offset) => source.charAt(offset) === term.charAt(0).toLowerCase() && !isSentenceStart(source, offset));
  const capital = later.filter((offset) => source.charAt(offset) === term.charAt(0));
  return lower.length > 0 && lower.length < capital.length && lower.length <= limit ? lower : [];
};

/** How far back a sentence's start is looked for: past a few spaces to the mark before them. */
const LOOK_BACK = 40;
const SENTENCE_END = new Set([".", "!", "?", ":"]);

/** A sentence's first word is capitalised whatever it is, so only a lower-case use inside a sentence counts. */
const isSentenceStart = (source: string, offset: number): boolean => {
  const before = source.slice(Math.max(0, offset - LOOK_BACK), offset);
  const text = before.trimEnd();
  return (offset < LOOK_BACK && text === "") || before.slice(text.length).includes("\n") || SENTENCE_END.has(text.at(-1) ?? "");
};

/** Where the sentence holding the definition ends: a use inside it ("Customer" means the party named "Customer") belongs to the definition. */
const definingSentenceEnd = (doc: ProseDocument, definition: Span): number =>
  doc.sentences.find((sentence) => sentence.span.start <= definition.start && definition.start < sentence.span.end)?.span.end ?? definition.end;

const VERBAL = new Set(["VERB", "AUX"]);

/** A word used as a verb ("you input"), not the defined thing ("the Input"): a different word that shares the spelling. */
const isVerbAt = (doc: ProseDocument, offset: number): boolean => {
  const tokens = doc.sentences.find((candidate) => candidate.span.start <= offset && offset < candidate.span.end)?.tokens ?? [];
  const at = tokens.findIndex((candidate) => candidate.span.start <= offset && offset < candidate.span.end);
  const token = tokens[at];
  if (token === undefined) return false;
  // After a subject pronoun the word is its verb (you input), whatever the tagger says; after a possessive (your input) it is a noun.
  const before = tokens[at - 1];
  const afterSubject = before?.pos === "PRON" && before.features?.["Poss"] !== "Yes";
  return VERBAL.has(token.pos) || afterSubject;
};

export const definedTermForm: Detector = (doc, options): Finding[] => {
  if (doc.structure === undefined) return [];
  const texts = bodyOf(doc);
  return firstDefinitions(definedTerms(doc.structure)).flatMap(({ term, spans }) => {
    const uses = usesOf(term.term, texts, spans, "loose");
    const definingEnd = definingSentenceEnd(doc, term.span);
    const quoted = quotedUses(doc.source, term.term, uses, definingEnd).map((offset) =>
      finding(doc, "defined-term-form", offset, "quoted", { term: term.term, line: term.line }),
    );
    const nounUses = uses.filter((offset) => !isVerbAt(doc, offset));
    const lower = lowerCaseUses(doc.source, term.term, nounUses, definingEnd, options.limit).map((offset) =>
      finding(doc, "defined-term-form", offset, "case", { term: term.term, line: term.line }),
    );
    return [...quoted, ...lower];
  });
};

/** The words a long name is made of: nouns and names (株式会社 みなと 製作所, Acme Corporation), and the marks inside one. */
const NAME_PARTS = new Set(["NOUN", "PROPN", "NUM"]);
const NAME_MARKS = new Set(["・", "&", "＆", ".", ","]);
/** A long name shorter than this (法律, Customer) is an ordinary word, used in its own sense again. */
const MIN_NAME_CHARS = 4;
/** In English a long name has two words or more (Acme Corporation); one capitalised word is the term's own kind of word. */
const MIN_NAME_WORDS = 2;
const LATIN = /\p{Script=Latin}/u;

const isNamePart = (token: Token): boolean => NAME_PARTS.has(token.pos) || NAME_MARKS.has(token.surface);

/** The long name written right before an inline definition: the run of name words that ends at its opening bracket. */
export const nameBefore = (sentence: Sentence, bracket: number): string | undefined => {
  const tokens = (sentence.tokens ?? []).filter((token) => token.span.end <= bracket);
  const firstOfRun = tokens.findLastIndex((token) => !isNamePart(token)) + 1;
  if (isModifier(tokens[firstOfRun - 1])) return undefined;
  const run = tokens.slice(firstOfRun).filter((token, index, all) => index > 0 || !NAME_MARKS.has(token.surface) || all.length === 1);
  const first = run[0];
  const end = run.at(-1);
  if (first === undefined || end === undefined || bracket - end.span.end > 1) return undefined;
  const name = withoutTrailingMarks(sentence.text.slice(first.span.start - sentence.span.start, end.span.end - sentence.span.start));
  const words = name.split(/\s+/u).length;
  return [...name].length < MIN_NAME_CHARS || (LATIN.test(name) && words < MIN_NAME_WORDS) ? undefined : name;
};

/**
 * A word that narrows the name before it: an article, an adjective, a verb, or の (妊娠中の女性従業員, the Beta Preview, 本利用規約).
 * The words then name a kind of thing the definition picks out, not one party, and are used in their own sense again.
 */
const MODIFIERS = new Set(["DET", "ADJ", "VERB", "AUX"]);
const isModifier = (token: Token | undefined): boolean => token !== undefined && (MODIFIERS.has(token.pos) || token.surface === "の");

const TRAILING_MARKS = new Set([",", ".", " "]);

const withoutTrailingMarks = (text: string): string => {
  const chars = [...text];
  return chars.slice(0, chars.findLastIndex((char) => !TRAILING_MARKS.has(char)) + 1).join("");
};

/** Where the inline definition's bracket opens: （以下「甲」という。） or ("Seller"). */
const bracketBefore = (source: string, definition: Span): number => {
  const before = source.slice(Math.max(0, definition.start - 2), definition.start + 1);
  const at = Math.max(before.lastIndexOf("（"), before.lastIndexOf("("));
  return at === -1 ? -1 : Math.max(0, definition.start - 2) + at;
};

export type RepeatedName = { readonly offset: number; readonly name: string; readonly term: string; readonly line: number };

/** A line that holds the short name too (甲 株式会社みなと) or little else than the long name: a signature block names both. */
const isNameLine = (source: string, offset: number, name: string, term: string): boolean => {
  const start = source.lastIndexOf("\n", offset - 1) + 1;
  const end = source.indexOf("\n", offset);
  const line = source.slice(start, end === -1 ? source.length : end).trim();
  const SLACK = 12;
  return line.includes(term) || [...line].length <= [...name].length + SLACK;
};

/** A name inside a longer word (東京大学 in 東京大学大学院, Acme in Acmeware) is part of another name. */
const WORD_CHAR = /[\p{Script=Han}\p{Script=Katakana}\p{Script=Latin}\p{N}ー]/u;
const standsAlone = (source: string, offset: number, name: string): boolean =>
  !WORD_CHAR.test(source.charAt(offset - 1)) && !WORD_CHAR.test(source.charAt(offset + name.length));

/**
 * Each use of a long name after the definition gave it a short name, outside a signature line. A name that is itself a
 * defined term (during each Subscription Term ("Permitted Use")) is a clause's last words, not the thing being named.
 */
export const repeatedNames = (doc: ProseDocument, terms: readonly DefinedTerm[]): RepeatedName[] => {
  const defined = new Set(terms.map((term) => term.term));
  return terms
    .filter((term) => term.inline)
    .flatMap((term) => {
      const bracket = bracketBefore(doc.source, term.span);
      const sentence = doc.sentences.find((candidate) => candidate.span.start <= bracket && bracket < candidate.span.end);
      const name = sentence === undefined || bracket === -1 ? undefined : nameBefore(sentence, bracket);
      if (name === undefined || name === term.term || term.term.includes(name) || defined.has(name)) return [];
      const pattern = new RegExp(escapeRegExp(name), "gu");
      return doc.sentences
        .filter((later) => later.span.start > term.span.end)
        .flatMap((later) => [...later.text.matchAll(pattern)].map((match) => later.span.start + match.index))
        .filter((offset) => standsAlone(doc.source, offset, name) && !isNameLine(doc.source, offset, name, term.term))
        .map((offset) => ({ offset, name, term: term.term, line: term.line }));
    });
};

export const definedNameRepeated: Detector = (doc): Finding[] =>
  doc.structure === undefined
    ? []
    : repeatedNames(doc, definedTerms(doc.structure)).map((repeated) =>
        finding(doc, "defined-name-repeated", repeated.offset, "name", { name: repeated.name, term: repeated.term, line: repeated.line }),
      );
