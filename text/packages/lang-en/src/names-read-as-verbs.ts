// A name the tagger reads as a verb or a pronoun because its lower-case spelling is one: AI as the "ai" of ain't, CA as the
// "ca" of can't, the US as "us", the IS department as "is". The tagger's vocabulary is keyed by the lower-case word, so it
// cannot tell the two apart; the sentence can.

type TaggedWord = { readonly value: string; readonly pos: string; readonly lemma?: string };

const CAPITALS = /^\p{Lu}{2,}$/u;

/** Penn tags a name is never given: the verb forms, the modal and the personal pronoun. */
const VERB_OR_PRONOUN = /^(?:VB[DGNPZ]?|MD|PRP)$/u;

/** The second half of a negative contraction, as the tagger splits it off (ca|n't). */
const NEGATION = "n't";

export type NameReadings = {
  /** The first halves of a negative contraction, lower case (ai, ca, wo, sha). */
  readonly contractionHeads: ReadonlySet<string>;
  /** Whether a word opens a noun phrase that a verb or a pronoun cannot follow: an article or a possessive. */
  readonly opensNounPhrase: (word: TaggedWord) => boolean;
};

/** A contraction's first half with no n't after it is not the contraction (AI is changing, lives in CA). */
const isUnpairedContractionHead = (tagged: readonly TaggedWord[], at: number, heads: ReadonlySet<string>): boolean =>
  heads.has((tagged[at]?.value ?? "").toLowerCase()) && tagged[at + 1]?.value.toLowerCase() !== NEGATION;

/**
 * Capitals right after an article or a possessive (the US office, our IT team, the company's IS staff) stand where a noun
 * stands. Capitals elsewhere stay as the tagger read them: "I AM here", "it IS done" and "a hurricane DID form" are emphasis,
 * and "That IS correct" opens with a demonstrative, not an article.
 */
const isCapitalsAfterOpener = (tagged: readonly TaggedWord[], at: number, opensNounPhrase: NameReadings["opensNounPhrase"]): boolean => {
  const previous = tagged[at - 1];
  return CAPITALS.test(tagged[at]?.value ?? "") && previous !== undefined && opensNounPhrase(previous);
};

/** The positions of words the tagger read as a verb or a pronoun that the sentence shows to be names. */
export const namesReadAsVerbs = (tagged: readonly TaggedWord[], readings: NameReadings): readonly number[] =>
  tagged.flatMap((word, at) =>
    VERB_OR_PRONOUN.test(word.pos) &&
    (isUnpairedContractionHead(tagged, at, readings.contractionHeads) || isCapitalsAfterOpener(tagged, at, readings.opensNounPhrase))
      ? [at]
      : [],
  );

const asName = (word: TaggedWord): TaggedWord => ({ value: word.value, pos: "NNP", lemma: word.value.toLowerCase() });

/**
 * The sentence read again with each name at `positions` replaced by `placeholder`, a word the tagger does not know: the names
 * become proper nouns, and their neighbours take the tagger's reading of a sentence with a name there (the US team: team is a
 * noun, not a verb after "us"). When the two readings do not line up word for word, only the names change.
 */
export const rereadAsNames = (
  entries: readonly TaggedWord[],
  again: readonly TaggedWord[],
  positions: readonly number[],
  placeholder: string,
): readonly TaggedWord[] => {
  const names = new Set(positions);
  const aligned = again.length === entries.length && again.every((word, at) => word.value === (names.has(at) ? placeholder : entries[at]?.value));
  const source = aligned ? again : entries;
  return source.map((word, at) => {
    const original = entries[at] ?? word;
    return names.has(at) ? asName(original) : { ...word, value: original.value };
  });
};
