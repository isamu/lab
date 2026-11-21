/** 解析器が返す 1 語。pos は Penn Treebank。 */
type TaggedWord = { readonly value: string; readonly pos: string; readonly lemma?: string };

/** 語彙が引ける品詞の並び（語 → Penn Treebank）。 */
type Vocabulary = (word: string) => readonly string[] | undefined;

/** "the very light of day", "its very own": after one of these, "very" is an adjective itself and the noun after it stays a noun. */
const DETERMINER_TAG = new Set(["DT", "PRP$", "WP$", "POS"]);
const INDEFINITE = new Set(["a", "an"]);
const BE = new Set(["be", "am", "is", "are", "was", "were", "been", "being"]);
/** What may follow a predicate adjective: the end of a clause ("is very fast." "is very fast, and"). */
const CLAUSE_END_TAG = new Set([".", ",", ":", "CC"]);
const NOUN_TAG = new Set(["NN", "NNS"]);

const canBeAdjective = (word: TaggedWord, vocabulary: Vocabulary): boolean => vocabulary(word.value.toLowerCase())?.includes("JJ") === true;

const isBe = (word: TaggedWord | undefined): boolean => word !== undefined && BE.has(word.lemma ?? word.value.toLowerCase());

/** "is very light and very fast": the second predicate adjective follows a conjunction after the first. */
const followsPredicate = (read: readonly TaggedWord[], at: number): boolean => {
  const before = read[at - 2];
  if (before?.pos === "CC") return read[at - 3]?.pos === "JJ";
  return isBe(before);
};

/**
 * An adverb after "be very" that ends the clause ("is very fast."), or one before a noun ("a very fast parser"), is the
 * adjective. "runs very fast" and "is very well documented" keep the adverb.
 */
const standsAsAdjective = (tagged: readonly TaggedWord[], read: readonly TaggedWord[], at: number): boolean => {
  const next = tagged[at + 1];
  if (next !== undefined && NOUN_TAG.has(next.pos)) return true;
  return followsPredicate(read, at) && (next === undefined || CLAUSE_END_TAG.has(next.pos));
};

const veryAsAdjective = (before: TaggedWord | undefined): boolean =>
  before !== undefined && DETERMINER_TAG.has(before.pos) && !INDEFINITE.has(before.value.toLowerCase());

const readAsAdjective = (tagged: readonly TaggedWord[], read: readonly TaggedWord[], at: number, word: TaggedWord): boolean => {
  if (word.pos === "NN") return !veryAsAdjective(tagged[at - 2]);
  return word.pos === "RB" && standsAsAdjective(tagged, read, at);
};

const isAfterDegree = (tagged: readonly TaggedWord[], at: number, degreeAdverbs: ReadonlySet<string>): boolean => {
  const degree = tagged[at - 1];
  return degree !== undefined && degreeAdverbs.has(degree.value.toLowerCase());
};

/**
 * A word right after a degree adverb ("very light", "very fast") that the tagger read as a noun or an adverb, though its
 * vocabulary also lists it as an adjective, is read as the adjective. A noun follows "very" only where "very" is the
 * adjective ("the very light").
 */
export const degreeAdjectives = <T extends TaggedWord>(tagged: readonly T[], degreeAdverbs: ReadonlySet<string>, vocabulary: Vocabulary): readonly T[] =>
  tagged.reduce<T[]>((read, word, at) => {
    const adjective = isAfterDegree(tagged, at, degreeAdverbs) && readAsAdjective(tagged, read, at, word) && canBeAdjective(word, vocabulary);
    read.push(adjective ? { ...word, pos: "JJ" } : word);
    return read;
  }, []);
