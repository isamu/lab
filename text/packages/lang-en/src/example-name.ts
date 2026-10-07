// Whether a name quoted in bare brackets (("The key point is")) reads as a quoted example rather than a defined term.

/** Words a capitalised name keeps in lower case (Terms of Use, Statement of Work). */
const MINOR_WORDS: ReadonlySet<string> = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "nor",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "as",
  "by",
  "from",
  "per",
  "via",
  "vs",
]);

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const LOWER_START = /^\p{Ll}/u;
/** A capital inside the word (iOS, eBay) makes it a name, whatever its first letter. */
const HAS_UPPER = /\p{Lu}/u;
/** A statute names a party in lower case after an article: ("the seller"), ("a sub-processor"). */
const ARTICLE_LEAD = /^(?:the|a|an)\s/u;

/**
 * A defined term is one word ("Seller"), a capitalised name ("Use of Customer Data"), or a statute's lower-case party
 * after an article ("the annual period"). Several words with one in lower case that a name would capitalise ("The key
 * point is", "silently fails", "sections 44 and 45") quote an example instead.
 */
export const readsAsExample = (name: string): boolean => {
  const words = [...name.matchAll(WORD)].map((match) => match[0]);
  if (words.length < 2 || ARTICLE_LEAD.test(name)) return false;
  return words.some((word) => LOWER_START.test(word) && !HAS_UPPER.test(word) && !MINOR_WORDS.has(word));
};
