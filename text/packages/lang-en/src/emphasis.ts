// A word written in capitals for emphasis (the office will NEVER call you), told from an acronym by the dictionary and by how
// the tagger read it in its sentence.

const CAPITALS = /^\p{Lu}{2,}$/u;
const LOWERCASE = /\p{Ll}/u;

const ADVERB_TAGS: ReadonlySet<string> = new Set(["RB", "RBR", "RBS"]);

/**
 * Penn tags of closed word classes: preposition, conjunction, determiner, numeral, pronoun, particle, modal. An acronym names a
 * thing, so it stands where a noun stands, never where one of these does.
 */
const CLOSED_CLASS_TAGS: ReadonlySet<string> = new Set(["IN", "CC", "DT", "PDT", "CD", "PRP", "PRP$", "TO", "RP", "MD", "WDT", "WP", "EX"]);

/** A determiner or possessive opens a noun phrase: what follows it (the IT team, the US office) is a name, though a numeral may come between (the ONE storm). */
const NOUN_PHRASE_OPENERS: ReadonlySet<string> = new Set(["DT", "PDT", "PRP$", "POS"]);

/** What can stand right before a finite verb in a sentence: a common noun or pronoun subject, or a modal (a hurricane DID form). */
const SUBJECT_TAGS: ReadonlySet<string> = new Set(["NN", "NNS", "PRP", "MD"]);

type TaggedWord = { readonly value: string; readonly pos: string };

type TagsOf = (word: string) => readonly string[] | undefined;

/**
 * The dictionary knows the lower-case word, and only as an adverb (never, always, also). An acronym names a thing, so a word
 * with no noun or adjective reading cannot be one. A word that is also a noun or an adjective (fast, eagle, cheese) is kept:
 * FAST and EAGLE are a telescope and a simulation, and the context tagger cannot tell them from emphasis.
 */
export const isEmphasisedAdverb = (surface: string, tagsOf: TagsOf): boolean => {
  if (!CAPITALS.test(surface)) return false;
  const tags = tagsOf(surface.toLowerCase()) ?? [];
  return tags.length > 0 && tags.every((tag) => ADVERB_TAGS.has(tag));
};

/** After a verb, a word the tagger read as a noun must also be a verb in the dictionary (DID form), or it is what the capitals name (DID token). */
const canFollowVerb = (next: TaggedWord, tagsOf: TagsOf): boolean => !next.pos.startsWith("NN") || (tagsOf(next.value.toLowerCase()) ?? []).includes("VB");

/**
 * The tagger read the capitals word, in its sentence, as one of the dictionary's readings of the lower-case word, and that
 * reading is a closed class (AFTER the departure, NOR a remote position), or a verb right after its subject (a hurricane DID
 * form). The word sits inside lower-case prose, with a lower-case word on each side: at the start of a sentence (ON
 * Semiconductor), at its end (via IT.) or on a line alone (AT.) there is nothing to read it in. A verb after anything but its
 * subject, or before a noun, stays a name: on the GOES satellites, the states are: LISTEN, the user DID token. Adjectives
 * stay too: the WHOLE month reads like the SAFE framework, and only meaning tells them apart.
 */
const isReadAsWord = (tagged: readonly TaggedWord[], at: number, tagsOf: TagsOf): boolean => {
  const word = tagged[at];
  const [previous, next] = [tagged[at - 1], tagged[at + 1]];
  if (word === undefined || previous === undefined || next === undefined) return false;
  if (!(tagsOf(word.value.toLowerCase()) ?? []).includes(word.pos) || !LOWERCASE.test(previous.value) || !LOWERCASE.test(next.value)) return false;
  if (CLOSED_CLASS_TAGS.has(word.pos)) return word.pos === "CD" || !NOUN_PHRASE_OPENERS.has(previous.pos);
  return word.pos.startsWith("VB") && SUBJECT_TAGS.has(previous.pos) && canFollowVerb(next, tagsOf);
};

/** A word joined to its neighbour with no space (US-CERT, SOME/2, IT's) is part of a compound, a label or a name, not a word on its own. */
const JOINED = /[\p{L}\p{N}_&/'’-]/u;

type WordSpan = { readonly start: number; readonly end: number };

export const standsAlone = (text: string, span: WordSpan): boolean => !JOINED.test(text.charAt(span.start - 1)) && !JOINED.test(text.charAt(span.end));

/** A capitals word the sentence reads as an English word (not the adverb-only case above), so emphasis and not an acronym. */
export const isEmphasisedWord = (tagged: readonly TaggedWord[], at: number, tagsOf: TagsOf): boolean => {
  const surface = tagged[at]?.value ?? "";
  return CAPITALS.test(surface) && isReadAsWord(tagged, at, tagsOf);
};
