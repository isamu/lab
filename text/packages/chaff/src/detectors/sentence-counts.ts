import type { Detector, DetectorOptions, Finding, Lexicon, ProseDocument, Sentence, Span, Token } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { isWithinAny, quotedIn } from "../quoted-span.ts";
import { entryOpens } from "./lexicon-match.ts";
import { laterAlternatives, laterJoined } from "../alternative-words.ts";
import { isContrastiveGa } from "./adversative-ga.ts";

type TokenTest = (token: Token, at: number, tokens: readonly Token[]) => boolean;

const wordsOf = (lexicon: Lexicon | undefined): ReadonlySet<string> => new Set((lexicon ?? []).map((entry) => entry.pattern));

/** The terms whose counted word belongs to the term itself (電磁的方法), not to the writer's style. */
export const FIXED_TERM_LEXICON = "teki-fixed-term";

/** Where the sentence holds one of the terms, in the document's coordinates. */
const termSpans = (sentence: Sentence, terms: Lexicon): Span[] =>
  terms.flatMap((entry) =>
    [...sentence.text.matchAll(new RegExp(escapeRegExp(entry.pattern), "gu"))].map((match) => ({
      start: sentence.span.start + match.index,
      end: sentence.span.start + match.index + entry.pattern.length,
    })),
  );

/**
 * The tokens of a sentence that pass the test, outside anything quoted in 「」『』 and outside the fixed terms: neither a
 * quotation nor a term the law defines (電磁的方法) is the writer's to rephrase.
 */
const countedTokens = (sentence: Sentence, test: TokenTest, fixedTerms: Lexicon): Token[] => {
  const kept = [...quotedIn(sentence), ...termSpans(sentence, fixedTerms)];
  return (sentence.tokens ?? []).filter((token, at, tokens) => test(token, at, tokens) && !isWithinAny(kept, token.span));
};

const findingOf = (sentence: Sentence, counted: readonly Token[], limit: number): Finding => ({
  rule: "",
  severity: "info",
  line: 0,
  column: 0,
  quote: sentence.text.trim(),
  values: { word: counted[0]?.surface ?? "", count: counted.length, limit, offset: sentence.span.start },
});

const sentencesOver = (doc: ProseDocument, limit: number, test: TokenTest, fixedTerms: Lexicon = []): Finding[] =>
  doc.sentences.flatMap((sentence) => {
    const counted = countedTokens(sentence, test, fixedTerms);
    return counted.length > limit ? [findingOf(sentence, counted, limit)] : [];
  });

/** The counted words that only repeat the point of the one before: a later option of a choice, a later half of a joined pair. */
const laterOfOnePoint = (tokens: readonly Token[], counted: readonly number[]): ReadonlySet<number> =>
  new Set([...laterAlternatives(tokens, counted), ...laterJoined(tokens, counted)]);

/** A mark that opens an item with a circled number (③): an item of a list written inside the sentence. */
const CIRCLED_ITEM = /^[①-⒇❶-❿]/u;

/** The counted tokens of the sentence's largest part, the sentence cut before each circled item mark (①Credit：…、②…). */
const largestItem = (sentence: Sentence, counted: readonly Token[]): readonly Token[] => {
  const marks = (sentence.tokens ?? []).filter((token) => CIRCLED_ITEM.test(token.surface)).map((token) => token.span.start);
  const itemOf = (token: Token): number => marks.filter((start) => start <= token.span.start).length;
  const items = counted.reduce((byItem, token) => byItem.set(itemOf(token), [...(byItem.get(itemOf(token)) ?? []), token]), new Map<number, Token[]>());
  return [...items.values()].reduce<readonly Token[]>((largest, item) => (item.length > largest.length ? item : largest), []);
};

/**
 * A sentence holding more than limit tokens written as one of the lexicon's words (the suffix 的). The options of one choice
 * (連続的か断続的か、一時的) and a joined pair (信仰的主観的) count once: each names one point. A list written inside the sentence
 * (①…、②…) is counted item by item, as each item is a point of its own.
 */
export const sentenceWordCount: Detector = (doc, options): Finding[] => {
  const words = wordsOf(options.lexicon);
  const onePoint = new WeakMap<readonly Token[], ReadonlySet<number>>();
  const laterOf = (tokens: readonly Token[]): ReadonlySet<number> => {
    const known = onePoint.get(tokens);
    if (known !== undefined) return known;
    const found = laterOfOnePoint(
      tokens,
      tokens.flatMap((token, at) => (words.has(token.surface) ? [at] : [])),
    );
    onePoint.set(tokens, found);
    return found;
  };
  const isCounted: TokenTest = (token, at, tokens) => words.has(token.surface) && !laterOf(tokens).has(at);
  const fixedTerms = doc.lexicons[FIXED_TERM_LEXICON] ?? [];
  return doc.sentences.flatMap((sentence) => {
    const counted = largestItem(sentence, countedTokens(sentence, isCounted, fixedTerms));
    return counted.length > options.limit ? [findingOf(sentence, counted, options.limit)] : [];
  });
};

const NOMINAL: ReadonlySet<string> = new Set(["NOUN", "PROPN", "NUM"]);

const isNominal = (token: Token | undefined): boolean => token !== undefined && NOMINAL.has(token.pos);

const CLOSING_TO_OPENING: Readonly<Record<string, string>> = { "）": "（", ")": "(", "」": "「", "』": "『", "】": "【" };

const isSpace = (token: Token | undefined): boolean => token !== undefined && token.surface.trim() === "";

/** The index of the token an item ends with, before `at`: past spaces and a bracketed note (名前（必須）、). */
const itemEndBefore = (at: number, tokens: readonly Token[]): number => {
  const before = tokens.findLastIndex((token, index) => index < at && !isSpace(token));
  const opening = CLOSING_TO_OPENING[tokens[before]?.surface ?? ""];
  if (opening === undefined) return before;
  const opened = tokens.findLastIndex((token, index) => index < before && token.surface === opening);
  return opened === -1 ? before : itemEndBefore(opened, tokens);
};

/** The index of the token the next item starts with, past spaces. */
const itemStartAfter = (at: number, tokens: readonly Token[]): number => tokens.findIndex((token, index) => index > at && !isSpace(token));

/** A prefix bound to the noun after it (第I, 各部署) starts a noun. */
const isBoundPrefix = (token: Token | undefined): boolean => token?.features?.["Bound"] === "Yes" && token.pos === "ADJ";

/** A dependent noun (こと, よう, ため) ends a clause, not a listed item, when a prefixed noun follows (取り組むよう、ご指示). */
const isDependentNoun = (token: Token | undefined): boolean => token?.features?.["NounType"] === "Dependent";

const startsNoun = (at: number, tokens: readonly Token[], itemEnd: Token | undefined): boolean => {
  const start = itemStartAfter(at, tokens);
  return isNominal(tokens[start]) || (isBoundPrefix(tokens[start]) && isNominal(tokens[start + 1]) && !isDependentNoun(itemEnd));
};

const QUOTE_CLOSERS: ReadonlySet<string> = new Set(["」", "』"]);
const QUOTE_OPENERS: ReadonlySet<string> = new Set(["「", "『"]);

/** Whether the token at `closer` closes a quotation of a noun phrase (「技術の確立」), not of a clause (「成功した」). */
const closesNounQuotation = (closer: number, tokens: readonly Token[]): boolean =>
  QUOTE_CLOSERS.has(tokens[closer]?.surface ?? "") && isNominal(tokens[closer - 1]);

/**
 * A comma from one quoted noun phrase straight to the next (「計画」、「予算」) lists quoted items. A noun before a quotation
 * (対応するもの、「A」に関しては) may end a clause, and so may a quoted clause, so only noun quotation to noun quotation counts.
 */
const betweenQuotations = (at: number, tokens: readonly Token[]): boolean => {
  const before = tokens.findLastIndex((token, index) => index < at && !isSpace(token));
  const start = itemStartAfter(at, tokens);
  if (!QUOTE_OPENERS.has(tokens[start]?.surface ?? "")) return false;
  const after = tokens.findIndex((token, index) => index > start && QUOTE_CLOSERS.has(token.surface));
  return closesNounQuotation(before, tokens) && closesNounQuotation(after, tokens);
};

/**
 * A comma between two nouns separates listed items (名前、会社名、連絡先), not clauses. A bracketed note after an item is part of
 * it, a noun after its prefix (第I、第II) is a noun, and so is a quotation listed next to another.
 */
export const separatesItems = (at: number, tokens: readonly Token[]): boolean => {
  const itemEnd = tokens[itemEndBefore(at, tokens)];
  return betweenQuotations(at, tokens) || (isNominal(itemEnd) && startsNoun(at, tokens, itemEnd));
};

/** A sentence cut by more than limit of the lexicon's commas (読点). Commas between listed nouns are not counted. */
export const sentenceCommaCount: Detector = (doc, options): Finding[] => {
  const commas = wordsOf(options.lexicon);
  return sentencesOver(doc, options.limit, (token, at, tokens) => commas.has(token.surface) && !separatesItems(at, tokens));
};

const CONJUNCTIVE = "SCONJ";

/** The phrases ending in a prefatory が (繰り返しになりますが、〜の件でありますが): no contrast with what follows. */
export const PREFATORY_LEXICON = "adversative-ga-prefatory";

/** The phrases opening with a causal が (惧れるが故に): the parser reads that が as conjunctive, but it gives a reason, not a contrast. */
export const CAUSAL_LEXICON = "adversative-ga-causal";

/**
 * A sentence joining more than limit clauses with the lexicon's conjunctive particle (逆接の「が」), not the same word as a
 * case particle, not inside a prefatory or a causal phrase, and contrasting two clauses (adversative-ga.ts).
 */
export const sentenceConjunctiveCount: Detector = (doc, options): Finding[] => {
  const words = wordsOf(options.lexicon);
  const notContrast = [...(doc.lexicons[PREFATORY_LEXICON] ?? []), ...(doc.lexicons[CAUSAL_LEXICON] ?? [])];
  const counts: TokenTest = (token, at, tokens) => token.pos === CONJUNCTIVE && words.has(token.surface) && isContrastiveGa(at, tokens);
  return sentencesOver(doc, options.limit, counts, notContrast);
};

type Opened = { readonly sentence: Sentence; readonly opener: string | undefined };

/**
 * The lexicon's word the sentence opens with, unless it opens with one of `notOpeners`: "This Agreement" and "This section"
 * point at the document itself, not back at the sentence before.
 */
const openerOf = (sentence: Sentence, lexicon: Lexicon, notOpeners: Lexicon): string | undefined =>
  notOpeners.some((entry) => entryOpens(sentence, entry)) ? undefined : lexicon.find((entry) => entryOpens(sentence, entry))?.pattern;

/** The phrases that open a sentence with a lexicon word but do not point back (this-document references). */
export const NOT_OPENER_LEXICON = "demonstrative-not-opener";

/** Runs of consecutive sentences in one paragraph that each open with a lexicon word. */
export const openerRuns = (sentences: readonly Sentence[], lexicon: Lexicon, notOpeners: Lexicon = []): Opened[][] =>
  sentences
    .map((sentence) => ({ sentence, opener: openerOf(sentence, lexicon, notOpeners) }))
    .reduce<Opened[][]>(
      (runs, opened) => {
        if (opened.opener === undefined) return [...runs, []];
        const last = runs.at(-1) ?? [];
        return [...runs.slice(0, -1), [...last, opened]];
      },
      [[]],
    )
    .filter((run) => run.length > 0);

const runFinding = (run: readonly Opened[], options: DetectorOptions): Finding => {
  const first = run[0];
  return {
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: run.map(({ sentence }) => sentence.text.trim()).join(""),
    values: { word: first?.opener ?? "", count: run.length, limit: options.limit, offset: first?.sentence.span.start ?? 0 },
  };
};

/** More than limit sentences in a row within one paragraph, each opening with a word from the lexicon (これ, その). */
export const openerRun: Detector = (doc, options): Finding[] => {
  const lexicon = options.lexicon ?? [];
  const notOpeners = doc.lexicons[NOT_OPENER_LEXICON] ?? [];
  return doc.paragraphs.flatMap((paragraph) =>
    openerRuns(paragraph.sentences, lexicon, notOpeners)
      .filter((run) => run.length > options.limit)
      .map((run) => runFinding(run, options)),
  );
};
