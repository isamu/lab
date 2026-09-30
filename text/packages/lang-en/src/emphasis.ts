// A word written in capitals for emphasis (the office will NEVER call you), told from an acronym by the dictionary.

const CAPITALS = /^\p{Lu}{2,}$/u;

const ADVERB_TAGS: ReadonlySet<string> = new Set(["RB", "RBR", "RBS"]);

/**
 * The dictionary knows the lower-case word, and only as an adverb (never, always, also). An acronym names a thing, so a word
 * with no noun or adjective reading cannot be one. A word that is also a noun or an adjective (fast, eagle, cheese) is kept:
 * FAST and EAGLE are a telescope and a simulation, and the context tagger cannot tell them from emphasis.
 */
export const isEmphasisedAdverb = (surface: string, tagsOf: (word: string) => readonly string[] | undefined): boolean => {
  if (!CAPITALS.test(surface)) return false;
  const tags = tagsOf(surface.toLowerCase()) ?? [];
  return tags.length > 0 && tags.every((tag) => ADVERB_TAGS.has(tag));
};
