import type { Detector, DetectorOptions, Finding, Lexicon, ProseDocument, Sentence, Span, Token } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { isWithinAny, quotedIn } from "../quoted-span.ts";
import { entryOpens } from "./lexicon-match.ts";

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

/** A sentence holding more than limit tokens written as one of the lexicon's words (the suffix 的). */
export const sentenceWordCount: Detector = (doc, options): Finding[] => {
  const words = wordsOf(options.lexicon);
  return sentencesOver(doc, options.limit, (token) => words.has(token.surface), doc.lexicons[FIXED_TERM_LEXICON] ?? []);
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

/** A comma between two nouns separates listed items (名前、会社名、連絡先), not clauses. A bracketed note after an item is part of it. */
export const separatesItems = (at: number, tokens: readonly Token[]): boolean =>
  isNominal(tokens[itemEndBefore(at, tokens)]) && isNominal(tokens[itemStartAfter(at, tokens)]);

/** A sentence cut by more than limit of the lexicon's commas (読点). Commas between listed nouns are not counted. */
export const sentenceCommaCount: Detector = (doc, options): Finding[] => {
  const commas = wordsOf(options.lexicon);
  return sentencesOver(doc, options.limit, (token, at, tokens) => commas.has(token.surface) && !separatesItems(at, tokens));
};

const CONJUNCTIVE = "SCONJ";

/** A sentence joining more than limit clauses with the lexicon's conjunctive particle (逆接の「が」), not the same word as a case particle. */
export const sentenceConjunctiveCount: Detector = (doc, options): Finding[] => {
  const words = wordsOf(options.lexicon);
  return sentencesOver(doc, options.limit, (token) => token.pos === CONJUNCTIVE && words.has(token.surface));
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
