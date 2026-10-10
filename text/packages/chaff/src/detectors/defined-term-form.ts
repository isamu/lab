// A defined term used later in another form, and a long name used again after its short name was defined. Pure. The
// definitions come from the document's structure tree (以下「甲」という, ("Seller")); which words may stand in a long
// name is read from the tokens' parts of speech.
import { definedTerms, usesOf, type BodyText, type DefinedTerm } from "../structure/definition-use.ts";
import { escapeRegExp } from "../orthography.ts";
import { prefixGroupsOf, prefixVariants, variantUses } from "../structure/term-prefix.ts";
import { quoteAt } from "./structure-tree.ts";
import { isPartOfAddress } from "./address-word.ts";
import { exactOffsets, extendedAfter, extendedBefore } from "./term-extension.ts";
import { CLOSES_SENTENCE, isNameField, isSignatureLine, opensClosingBlock, SLACK } from "./name-field.ts";
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
/** A quoted term right before these is defined again (「X」とは, 「X」といいます, "X" means), which duplicate-definition reads. */
const DEFINING_AFTER = /^(?:とは|という|といい(?:ます)?(?=[。、，）)\s]|$)|\s+(?:means|shall mean|refers to|has the meaning))/u;
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
/** The capital that starts each later word of a term (the O of Records Officer). */
const INNER_CAPITAL = /(?<=\s)\p{Lu}/gu;

const innerCapitals = (term: string): number[] => [...term.matchAll(INNER_CAPITAL)].map((match) => match.index);

/** Whether the letter at position at of the term is written in lower case at this use. */
const isLowered = (source: string, term: string, offset: number, at: number): boolean => source.charAt(offset + at) === term.charAt(at).toLowerCase();

/** The term with the capitals of its later words in lower case (Records officer), whose uses the term's own form does not find. */
export const innerLowered = (term: string): string => term.replace(INNER_CAPITAL, (capital) => capital.toLowerCase());

/**
 * The uses of a capitalised term written in lower case ("services" where "Services" is defined, "records officer" where
 * "Records Officer" is), when they are no more than the capitalised uses and at most limit: a document that writes it in
 * lower case more often uses the word in its ordinary sense on purpose. One of each is a slip to point at (the Software,
 * then the software).
 */
export const lowerCaseUses = (source: string, term: string, uses: readonly number[], definedAt: number, limit: number): number[] => {
  if (!UPPER_START.test(term) || term.toLowerCase() === term) return [];
  const inner = innerCapitals(term);
  // An address (support@pinecone.example) spells the name as the address must be, in either case; it is not a use.
  const later = uses.filter((offset) => offset > definedAt && !isPartOfAddress(source, offset, offset + term.length));
  const innerLower = (offset: number): boolean => inner.some((at) => isLowered(source, term, offset, at));
  const lower = later.filter((offset) => (isLowered(source, term, offset, 0) && !isSentenceStart(source, offset)) || innerLower(offset));
  const capital = later.filter((offset) => source.charAt(offset) === term.charAt(0) && !innerLower(offset));
  return lower.length > 0 && lower.length <= capital.length && lower.length <= limit ? lower : [];
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

const definingSentence = (doc: ProseDocument, definition: Span): Sentence | undefined =>
  doc.sentences.find((sentence) => sentence.span.start <= definition.start && definition.start < sentence.span.end);

/** Where the sentence holding the definition ends: a use inside it ("Customer" means the party named "Customer") belongs to the definition. */
const definingSentenceEnd = (doc: ProseDocument, definition: Span): number => definingSentence(doc, definition)?.span.end ?? definition.end;

const VERBAL = new Set(["VERB", "AUX"]);

const tokensAt = (doc: ProseDocument, offset: number): { readonly tokens: readonly Token[]; readonly at: number } => {
  const tokens = doc.sentences.find((candidate) => candidate.span.start <= offset && offset < candidate.span.end)?.tokens ?? [];
  return { tokens, at: tokens.findIndex((candidate) => candidate.span.start <= offset && offset < candidate.span.end) };
};

/** A word used as a verb ("you input"), not the defined thing ("the Input"): a different word that shares the spelling. */
const isVerbAt = (doc: ProseDocument, offset: number): boolean => {
  const { tokens, at } = tokensAt(doc, offset);
  const token = tokens[at];
  if (token === undefined) return false;
  // After a subject pronoun the word is its verb (you input), whatever the tagger says; after a possessive (your input) it is a noun.
  const before = tokens[at - 1];
  const afterSubject = before?.pos === "PRON" && before.features?.["Poss"] !== "Yes";
  return VERBAL.has(token.pos) || afterSubject;
};

const NAMING = new Set(["NOUN", "PROPN"]);

/**
 * A lower-case phrase that starts with a noun and has no adjective before it (the records officer) names the defined thing.
 * One that starts with an adjective or a possessive (its own confidential information, your content), or that an
 * adjective narrows (additional terms of service), is the ordinary phrase.
 */
const isNamingAt = (doc: ProseDocument, offset: number): boolean => {
  const { tokens, at } = tokensAt(doc, offset);
  return NAMING.has(tokens[at]?.pos ?? "") && tokens[at - 1]?.pos !== "ADJ";
};

/** The uses of the term, with those that write its later words in lower case (records officer for Records Officer), in order. */
const withLoweredWords = (doc: ProseDocument, term: string, texts: readonly BodyText[], spans: readonly Span[], uses: readonly number[]): number[] => {
  const lowered = innerLowered(term);
  if (lowered === term) return [...uses];
  const more = usesOf(lowered, texts, spans, "loose").filter((offset) => !uses.includes(offset) && isNamingAt(doc, offset));
  return [...uses, ...more].toSorted((left, right) => left - right);
};

/** The term written with another prefix of its group (本件業務 where 本業務 is defined), after the sentence that defines it. */
const prefixFindings = (doc: ProseDocument, texts: readonly BodyText[], term: DefinedTerm, definingEnd: number, defined: readonly string[]): Finding[] =>
  prefixVariants(term.term, prefixGroupsOf(doc.lexicons["defined-term-prefix"] ?? [])).flatMap((variant) =>
    defined.includes(variant)
      ? []
      : variantUses(doc.source, texts, variant, definingEnd, defined).map((offset) =>
          finding(doc, "defined-term-form", offset, "prefix", { term: term.term, written: variant, line: term.line }),
        ),
  );

/** The term set in quotes again, unless the document's profile says a quoted term is the term mentioned (「株主」とあるのは). */
const quotedFindings = (doc: ProseDocument, term: DefinedTerm, uses: readonly number[], definingEnd: number): Finding[] =>
  doc.profile?.quoteMentionsTerm === true
    ? []
    : quotedUses(doc.source, term.term, uses, definingEnd).map((offset) =>
        finding(doc, "defined-term-form", offset, "quoted", { term: term.term, line: term.line }),
      );

/** The term written longer with a word of its definition (文書管理責任者, the Application), after the sentence that defines it. */
const extendedFindings = (doc: ProseDocument, texts: readonly BodyText[], term: DefinedTerm, spans: readonly Span[], defined: readonly string[]): Finding[] => {
  const definition = definingSentence(doc, term.span)?.text ?? "";
  const pointers = (doc.lexicons["defined-term-pointer"] ?? []).map((entry) => entry.pattern);
  // Every sentence that defines the term (a second definition too) holds the long words it is defined from.
  const defining = spans.map((span) => definingSentence(doc, span)?.span ?? span);
  const definingEnd = definingSentenceEnd(doc, term.span);
  return texts
    .flatMap((text) => exactOffsets(text.text, text.start, term.term))
    .filter((offset) => offset > definingEnd && !defining.some((span) => span.start <= offset && offset < span.end))
    .flatMap((offset) => {
      const before = extendedBefore(doc.source, offset, term.term, definition, pointers);
      const written = before ?? (isSentenceStart(doc.source, offset) ? undefined : extendedAfter(doc.source, offset, term.term, definition));
      if (written === undefined || defined.includes(written)) return [];
      const start = before === undefined ? offset : offset + term.term.length - written.length;
      return [finding(doc, "defined-term-form", start, "extended", { term: term.term, written, line: term.line })];
    });
};

export const definedTermForm: Detector = (doc, options): Finding[] => {
  if (doc.structure === undefined) return [];
  const texts = bodyOf(doc);
  const terms = definedTerms(doc.structure);
  const defined = terms.map((term) => term.term);
  return firstDefinitions(terms).flatMap(({ term, spans }) => {
    const uses = usesOf(term.term, texts, spans, "loose");
    const definingEnd = definingSentenceEnd(doc, term.span);
    const quoted = quotedFindings(doc, term, uses, definingEnd);
    const caseUses = withLoweredWords(doc, term.term, texts, spans, uses);
    const nounUses = caseUses.filter((offset) => !isVerbAt(doc, offset));
    const lower = lowerCaseUses(doc.source, term.term, nounUses, definingEnd, options.limit).map((offset) =>
      finding(doc, "defined-term-form", offset, "case", { term: term.term, line: term.line }),
    );
    return [...quoted, ...lower, ...prefixFindings(doc, texts, term, definingEnd, defined), ...extendedFindings(doc, texts, term, spans, defined)];
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

/** A contact field's label: after a bullet or a number (1. 連絡先：), and as long as a label in English runs (Privacy Contact:). */
const CONTACT_LABEL = /^(?:(?:[-*+]|\d+[.)])\s+)?([^:：。.]{1,40})[:：]\s*/u;
const LABEL_MARKS = /[*_\s]+/gu;
/** After the name in a contact field, the next part after a space or a comma (, Tokyo), or the bracket that holds it (お問い合わせ窓口（株式会社みなと）). */
const NEXT_CONTACT_PART = /^\.?(?:$|[）)]|\s*,?\s+(?!\p{Ll}))/u;
/** A comma that goes on in lower case or 、 may also start a clause (, which may; 株式会社みなと、平日に受け付ける): the address field's bound. */
const COMMA_PART = /^\.?\s*[,、，]/u;

const endsWithContactLabel = (label: string, contactLabels: readonly string[]): boolean => {
  const bare = label.replaceAll(LABEL_MARKS, "").toLowerCase();
  return contactLabels.some((contact) => contact !== "" && bare.endsWith(contact.toLowerCase()));
};

/**
 * A field whose label ends with a contact label (窓口：, Attention:): the value names the party in full however long it is and
 * wherever the name sits in it, unless the name goes on as a sentence (連絡先：株式会社みなとは、…).
 */
const isContactField = (line: string, name: string, contactLabels: readonly string[]): boolean => {
  const label = CONTACT_LABEL.exec(line);
  if (label === null || !endsWithContactLabel(label[1] ?? "", contactLabels)) return false;
  const value = line.slice(label[0].length);
  const at = value.indexOf(name);
  if (at === -1) return false;
  const rest = value.slice(at + name.length);
  const continues = NEXT_CONTACT_PART.test(rest) || (COMMA_PART.test(rest) && [...rest].length <= SLACK * 2);
  return continues && !CLOSES_SENTENCE.test(rest.slice(1));
};

/**
 * A line that holds the short name too (甲 株式会社みなと), little else than the long name (a signature block names both),
 * or a field whose value is the name (Attention: …, 宛先：…), or a signature opening the closing block: an address gives the name in full.
 */
const isNameLine = (source: string, offset: number, name: string, term: string, contactLabels: readonly string[]): boolean => {
  const start = source.lastIndexOf("\n", offset - 1) + 1;
  const newline = source.indexOf("\n", offset);
  const end = newline === -1 ? source.length : newline;
  const line = source.slice(start, end).trim();
  // The short name inside the long one ("Pinecone" in "Pinecone Software Ltd") is not the short name written beside it.
  return (
    line.replaceAll(name, "").includes(term) ||
    [...line].length <= [...name].length + SLACK ||
    isNameField(line, name) ||
    (isSignatureLine(line, name) && opensClosingBlock(source, start, end)) ||
    isContactField(line, name, contactLabels)
  );
};

/** A name inside a longer word (東京大学 in 東京大学大学院, Acme in Acmeware) is part of another name. */
const WORD_CHAR = /[\p{Script=Han}\p{Script=Katakana}\p{Script=Latin}\p{N}ー]/u;
/**
 * A name inside a longer word (東京大学 in 東京大学大学院, Acme in Acmeware) is part of another name. A joining word right after
 * it (北浜精機株式会社及び乙) starts the next item of a list, and the name stands alone.
 */
export const standsAlone = (source: string, offset: number, name: string, joiners: readonly string[] = []): boolean => {
  const after = offset + name.length;
  const joined = joiners.some((joiner) => joiner !== "" && source.startsWith(joiner, after));
  return !WORD_CHAR.test(source.charAt(offset - 1)) && (joined || !WORD_CHAR.test(source.charAt(after)));
};

/**
 * Each use of a long name after the definition gave it a short name, outside a signature line. A name that is itself a
 * defined term (during each Subscription Term ("Permitted Use")) is a clause's last words, not the thing being named.
 */
export const repeatedNames = (doc: ProseDocument, terms: readonly DefinedTerm[]): RepeatedName[] => {
  const defined = new Set(terms.map((term) => term.term));
  const joiners = (doc.lexicons["enumeration-joiner"] ?? []).map((entry) => entry.pattern);
  const contactLabels = (doc.lexicons["contact-label"] ?? []).map((entry) => entry.pattern);
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
        .filter((offset) => standsAlone(doc.source, offset, name, joiners) && !isNameLine(doc.source, offset, name, term.term, contactLabels))
        .map((offset) => ({ offset, name, term: term.term, line: term.line }));
    });
};

export const definedNameRepeated: Detector = (doc): Finding[] =>
  doc.structure === undefined
    ? []
    : repeatedNames(doc, definedTerms(doc.structure)).map((repeated) =>
        finding(doc, "defined-name-repeated", repeated.offset, "name", { name: repeated.name, term: repeated.term, line: repeated.line }),
      );
