// An -ing form the dictionary knows as a noun and not as an adjective (heading, finding, setting) can head a noun phrase.

const COMMON_NOUN_TAGS: ReadonlySet<string> = new Set(["NN", "NNS"]);
const ADJECTIVE_TAGS: ReadonlySet<string> = new Set(["JJ", "JJR", "JJS"]);

/**
 * The tagger reads "A heading counts" as article + gerund + plural noun, but "heading" is also a noun, so "counts" may be its
 * verb. AlsoNoun=Yes says so. The dictionary gives most gerunds a noun reading too (the running of), so a gerund that is
 * also an adjective (missing, growing) stays a modifier: "a missing values" is a slip.
 */
export const gerundFeatures = (surface: string, tagsOf: (word: string) => readonly string[] | undefined): Readonly<Record<string, string>> => {
  const tags = tagsOf(surface.toLowerCase()) ?? [];
  const nounOnly = tags.some((tag) => COMMON_NOUN_TAGS.has(tag)) && !tags.some((tag) => ADJECTIVE_TAGS.has(tag));
  return nounOnly ? { VerbForm: "Ger", AlsoNoun: "Yes" } : { VerbForm: "Ger" };
};
