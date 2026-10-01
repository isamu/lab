import type { ProseDocument, Span, Token } from "../plugin.ts";
import type { Atom } from "./atom.ts";
import { overlapsAny, type SpanIndex } from "./spans.ts";

const PROPER_NOUN = "PROPN";

/** Two proper nouns with at most one space between them are one name: New York, 日本 銀行. */
const MAX_GAP = 1;

type Run = Span & { readonly words: number };

const joins = (run: Run | undefined, token: Token, text: string): run is Run =>
  run !== undefined && token.span.start - run.end <= MAX_GAP && text.slice(run.end, token.span.start).trim() === "";

/** Adjacent proper nouns, each run one name. */
const runsOf = (tokens: readonly Token[], text: string): Run[] =>
  tokens.reduce<Run[]>((runs, token) => {
    if (token.pos !== PROPER_NOUN) return runs;
    const last = runs.at(-1);
    if (joins(last, token, text)) runs[runs.length - 1] = { start: last.start, end: token.span.end, words: last.words + 1 };
    else runs.push({ start: token.span.start, end: token.span.end, words: 1 });
    return runs;
  }, []);

/** Words written in lower case. A capitalised word the same document also writes this way is a common word that began a sentence. */
const LOWER_CASE_WORD = /(?<![\p{L}\p{M}])\p{Ll}[\p{L}\p{M}]*/gu;

const lowerCaseWords = (source: string): ReadonlySet<string> => new Set(source.match(LOWER_CASE_WORD) ?? []);

const withLowerFirst = (word: string): string => `${word.charAt(0).toLowerCase()}${word.slice(1)}`;

/** A one-word name the document also writes in lower case ("Scammers" opening a sentence, "scammers" elsewhere). */
const isCommonWord = (run: Run, written: string, lowerCase: ReadonlySet<string>): boolean => {
  const lowered = withLowerFirst(written);
  return run.words === 1 && lowered !== written && lowerCase.has(lowered);
};

export type NounInput = {
  readonly doc: ProseDocument;
  /** Facts other readers took and what is not prose: a proper noun inside one is read as that, not again here. */
  readonly taken: SpanIndex;
  readonly lineOf: (offset: number) => number;
};

/** A name as one spelling: full-width letters and line breaks inside a name do not make another name. */
export const nameKey = (written: string): string => written.normalize("NFKC").replace(/\s+/gu, " ");

/** Whether the language package tagged parts of speech: without them, a document with sentences has no proper nouns to read. */
export const readsProperNouns = (doc: ProseDocument): boolean => doc.sentences.length === 0 || doc.sentences.some((sentence) => sentence.tokens !== undefined);

/**
 * Proper nouns as the part-of-speech tagger reads them in sentences. Headings are left out: they are compared as
 * headings, may be reworded, and a title-case heading makes every word look like a name.
 */
export const properNouns = (input: NounInput): Atom[] => {
  const { source } = input.doc;
  const lowerCase = lowerCaseWords(source);
  return input.doc.sentences.flatMap((sentence) =>
    runsOf(sentence.tokens ?? [], source).flatMap((run): Atom[] => {
      const text = source.slice(run.start, run.end);
      if (overlapsAny(input.taken, run) || isCommonWord(run, text, lowerCase)) return [];
      return [{ kind: "name", key: nameKey(text), text, line: input.lineOf(run.start) }];
    }),
  );
};
