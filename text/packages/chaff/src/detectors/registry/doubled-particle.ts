import type { Detector, ProseDocument, Sentence } from "../../plugin.ts";
import { doubledParticle } from "../token-shape.ts";
import { uncountedParticles, type UncountedWords } from "../../uncounted-particles.ts";

const COUNTER_LEXICON = "numbering-counter";
const COMPOUND_LEXICON = "compound-particle-noun";
const NUMBER_LEXICON = "number-word";
const NUMERAL_GROUPS: readonly (string | undefined)[] = ["digit", "place"];

const wordsOf = (doc: ProseDocument, particles: readonly string[]): UncountedWords => ({
  particles,
  numeralChars: new Set((doc.lexicons[NUMBER_LEXICON] ?? []).filter((entry) => NUMERAL_GROUPS.includes(entry.group)).map((entry) => entry.pattern)),
  counters: (doc.lexicons[COUNTER_LEXICON] ?? []).map((entry) => entry.pattern),
  compoundNouns: (doc.lexicons[COMPOUND_LEXICON] ?? []).map((entry) => entry.pattern),
});

const withoutUncounted = (sentence: Sentence, words: UncountedWords): Sentence => {
  const tokens = sentence.tokens ?? [];
  const uncounted = uncountedParticles(tokens, words);
  return uncounted.size === 0 ? sentence : { ...sentence, tokens: tokens.filter((token) => !uncounted.has(token)) };
};

/** The document with the uncounted particles dropped from each sentence. A proxy keeps the document's lazy parts lazy. */
const countableDocument = (doc: ProseDocument, words: UncountedWords): ProseDocument => {
  const sentences = doc.sentences.map((sentence) => withoutUncounted(sentence, words));
  const read = (target: ProseDocument, key: string | symbol, receiver: unknown): unknown =>
    key === "sentences" ? sentences : Reflect.get(target, key, receiver);
  return new Proxy(doc, { get: read });
};

export const detector: Detector = (doc, options) => {
  const particles = (options.lexicon ?? []).map((entry) => entry.pattern);
  return doubledParticle(countableDocument(doc, wordsOf(doc, particles)), options);
};
