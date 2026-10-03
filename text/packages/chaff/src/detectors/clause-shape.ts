import type { Detector, DetectorOptions, Finding, Lexicon, ProseDocument, Sentence, Token } from "../plugin.ts";
import { isWithinAny, quotedIn } from "../quoted-span.ts";

// The shape of a clause read from its words: how it ends, a paired word left alone, an adverb that needs a
// negation, a particle used where another one belongs. Every word comes from a lexicon; this file knows parts of speech.

const findingAt = (sentence: Sentence, offset: number, values: Readonly<Record<string, string | number>>): Finding => ({
  rule: "",
  severity: "info",
  line: 0,
  column: 0,
  quote: sentence.text.trim(),
  values: { ...values, offset },
});

const patternsOf = (lexicon: Lexicon | undefined, group?: string): ReadonlySet<string> =>
  new Set((lexicon ?? []).filter((entry) => group === undefined || entry.group === group).map((entry) => entry.pattern));

const isSpace = (token: Token | undefined): boolean => token !== undefined && token.surface.trim() === "";

/** The tokens of a sentence outside anything quoted in 「」『』, with their index in the sentence. */
const ownTokens = (sentence: Sentence): { readonly token: Token; readonly at: number }[] => {
  const quoted = quotedIn(sentence);
  return (sentence.tokens ?? []).flatMap((token, at) => (isWithinAny(quoted, token.span) ? [] : [{ token, at }]));
};

const wordOf = (token: Token): string => token.lemma ?? token.surface;

const isListed = (words: ReadonlySet<string>, token: Token | undefined): boolean =>
  token !== undefined && (words.has(token.surface) || words.has(wordOf(token)));

// --- ending-run: sentences in a row that end with the same words ---------------------------------------------

const TRAILING_POS: ReadonlySet<string> = new Set(["PUNCT", "SYM"]);
const TAIL_POS: ReadonlySet<string> = new Set(["AUX", "PART"]);
const VERBAL_POS: ReadonlySet<string> = new Set(["VERB"]);

/**
 * How a sentence ends: its closing auxiliaries, and the verb before them as written (しました, あります, 思います).
 * A noun before them is left out, so 必要です and 重要です end the same way. No auxiliary, no ending to compare.
 */
export const endingOf = (sentence: Sentence): string | undefined => {
  const tokens = (sentence.tokens ?? []).filter((token) => !isSpace(token));
  const last = tokens.findLastIndex((token) => !TRAILING_POS.has(token.pos));
  const head = tokens.slice(0, last + 1).findLastIndex((token) => !TAIL_POS.has(token.pos));
  if (head === last) return undefined;
  const headToken = tokens[head];
  const tail = tokens.slice(head + 1, last + 1).map((token) => token.surface);
  return [headToken !== undefined && VERBAL_POS.has(headToken.pos) ? headToken.surface : "", ...tail].join("");
};

type Ended = { readonly sentence: Sentence; readonly ending: string | undefined };

/** Runs of consecutive sentences with the same ending. A sentence with no ending to compare closes a run. */
export const endingRuns = (sentences: readonly Sentence[]): Ended[][] =>
  sentences
    .map((sentence) => ({ sentence, ending: endingOf(sentence) }))
    .reduce<Ended[][]>((runs, ended) => {
      const last = runs.at(-1) ?? [];
      const continues = ended.ending !== undefined && last[0]?.ending === ended.ending;
      return continues ? [...runs.slice(0, -1), [...last, ended]] : [...runs, [ended]];
    }, [])
    .filter((run) => run[0]?.ending !== undefined);

const runFinding = (run: readonly Ended[], limit: number): Finding => {
  const first = run[0];
  return {
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: run.map(({ sentence }) => sentence.text.trim()).join(""),
    values: { word: first?.ending ?? "", count: run.length, limit, offset: first?.sentence.span.start ?? 0 },
  };
};

/** More than limit sentences in a row within one paragraph that end with the same words. */
export const endingRun: Detector = (doc, options): Finding[] =>
  doc.paragraphs.flatMap((paragraph) =>
    endingRuns(paragraph.sentences)
      .filter((run) => run.length > options.limit)
      .map((run) => runFinding(run, options.limit)),
  );

// --- unpaired-parallel: a word that lists by pairs (〜たり) used once, followed by another clause -----------------

const CONTENT_POS: ReadonlySet<string> = new Set(["VERB", "ADJ", "NOUN", "PROPN"]);

const nextWord = (tokens: readonly Token[], at: number): Token | undefined => tokens.slice(at + 1).find((token) => !isSpace(token));

/**
 * The marker is left alone when the sentence holds it once and what follows starts a new clause: a comma,
 * or a content word other than the lexicon's closer (〜たり、映画を見る / 〜たり見る). 〜たりする and 〜たりもする are whole.
 */
const leftAlone = (tokens: readonly Token[], at: number, closers: ReadonlySet<string>, commas: ReadonlySet<string>): boolean => {
  const next = nextWord(tokens, at);
  if (next === undefined) return false;
  if (commas.has(next.surface)) return true;
  return CONTENT_POS.has(next.pos) && !isListed(closers, next);
};

const CONJUNCTION = "CCONJ";

const markersIn = (sentence: Sentence, markers: ReadonlySet<string>): { readonly token: Token; readonly at: number }[] =>
  ownTokens(sentence).filter(({ token }) => token.pos === CONJUNCTION && markers.has(token.surface));

/** A sentence that uses the lexicon's paired marker once and goes on without its partner. */
export const unpairedParallel: Detector = (doc, options): Finding[] => {
  const markers = patternsOf(options.lexicon, "marker");
  const closers = patternsOf(options.lexicon, "closer");
  const commas = patternsOf(options.lexicon, "comma");
  return doc.sentences.flatMap((sentence) => {
    const found = markersIn(sentence, markers);
    const only = found.length === 1 ? found[0] : undefined;
    if (only === undefined || !leftAlone(sentence.tokens ?? [], only.at, closers, commas)) return [];
    return [findingAt(sentence, only.token.span.start, { word: only.token.surface })];
  });
};

// --- adverb-polarity: an adverb that wants a negation, in a sentence that has none ------------------------------

type Negations = { readonly words: ReadonlySet<string>; readonly prefixes: readonly string[] };

const negationsOf = (lexicon: Lexicon | undefined): Negations => ({
  words: new Set((lexicon ?? []).filter((entry) => entry.group === undefined).map((entry) => entry.pattern)),
  prefixes: [...patternsOf(lexicon, "prefix")],
});

/** A negating word (ない, 違う) or a word opening with a negating prefix (不十分, 無理). */
const isNegation = (token: Token, negations: Negations): boolean =>
  isListed(negations.words, token) || negations.prefixes.some((prefix) => token.surface.length > prefix.length && token.surface.startsWith(prefix));

const hasNegation = (tokens: readonly Token[], from: number, negations: Negations): boolean =>
  tokens.slice(from + 1).some((token) => isNegation(token, negations));

/** The lexicon's adverb (全然, 決して) in a sentence with no word of the negation list after it. */
export const adverbPolarity: Detector = (doc, options): Finding[] => {
  const adverbs = patternsOf(options.lexicon);
  const negations = negationsOf(doc.lexicons["negation-word"]);
  return doc.sentences.flatMap((sentence) => {
    const tokens = sentence.tokens ?? [];
    const adverb = ownTokens(sentence).find(({ token }) => adverbs.has(token.surface));
    if (adverb === undefined || hasNegation(tokens, adverb.at, negations)) return [];
    return [findingAt(sentence, adverb.token.span.start, { word: adverb.token.surface })];
  });
};

// --- origin-particle: a comparison particle (より) used for "from" -------------------------------------------------

const SKIPPED_POS: ReadonlySet<string> = new Set(["ADV"]);
const PARTICLE = "ADP";
const NOMINAL_POS: ReadonlySet<string> = new Set(["NOUN", "PROPN"]);

/** The first word after the particle, past adverbs (順次) and a bound honorific prefix (ご連絡). */
const headAfter = (tokens: readonly Token[], at: number): number =>
  tokens.findIndex((token, index) => index > at && !isSpace(token) && !SKIPPED_POS.has(token.pos) && token.features?.["Bound"] !== "Yes");

/**
 * The head names a start or a sending (開始, 参る, 連絡). A noun head must be the action itself: followed by an object
 * marker or a light verb (受付を開始, 開始します), not a noun being compared (昨年より販売が増えた).
 */
const isOriginHead = (tokens: readonly Token[], head: number, heads: ReadonlySet<string>, objectMarkers: ReadonlySet<string>): boolean => {
  const token = tokens[head];
  if (token === undefined || !isListed(heads, token)) return false;
  if (!NOMINAL_POS.has(token.pos)) return true;
  const next = nextWord(tokens, head);
  return next !== undefined && (objectMarkers.has(next.surface) || next.features?.["VerbType"] === "Light");
};

type ParticleWords = { readonly particles: ReadonlySet<string>; readonly heads: ReadonlySet<string>; readonly objectMarkers: ReadonlySet<string> };

const originsIn = (sentence: Sentence, words: ParticleWords): Token[] => {
  const tokens = sentence.tokens ?? [];
  return ownTokens(sentence)
    .filter(
      ({ token, at }) =>
        token.pos === PARTICLE && words.particles.has(token.surface) && isOriginHead(tokens, headAfter(tokens, at), words.heads, words.objectMarkers),
    )
    .map(({ token }) => token);
};

const particleWords = (doc: ProseDocument, options: DetectorOptions): ParticleWords => ({
  particles: patternsOf(options.lexicon),
  heads: patternsOf(doc.lexicons["origin-head"], "head"),
  objectMarkers: patternsOf(doc.lexicons["origin-head"], "object"),
});

/** The lexicon's particle where it marks a starting point (4月1日より開始), which the lexicon's rewrite says instead. */
export const originParticle: Detector = (doc, options): Finding[] => {
  const words = particleWords(doc, options);
  const rewrites = new Map((options.lexicon ?? []).map((entry) => [entry.pattern, entry.rewrite ?? ""]));
  return doc.sentences.flatMap((sentence) =>
    originsIn(sentence, words).map((token) => findingAt(sentence, token.span.start, { word: token.surface, suggestion: rewrites.get(token.surface) ?? "" })),
  );
};
