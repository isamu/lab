// Words a document takes from elsewhere: a capitalised name (the Interagency Group) and a cited work (a reference list's entry,
// a citation written as a sentence). They keep the hyphens their owner gave them, unless the document writes the same name two
// ways (Co-working Space and Coworking Space), and a cited title keeps its ordinary words
// (factors beside the dataset FACTors). A capital the citing lost (arxiv for arXiv, ai-generated for AI-generated) is still
// the document's slip and is still compared. Pure.

/** Where a word was taken from: a capitalised name, or a cited work. */
export type Quoted = "name" | "cited";

/** A word, and for a word in a capitalised run, the run as written (Twenty-Nine Palms Band of Mission Indians), quoted or not. */
type QuotedWord = { readonly key: string; readonly spelling: string; readonly quoted?: Quoted | undefined; readonly name?: string | undefined };

/** The spelling without its hyphens: two spellings equal this way differ only in hyphenation (Interagency, inter-agency). */
const closedUp = (spelling: string): string => spelling.replaceAll("-", "");

/** A name without its case and hyphens: two names equal this way are one name (Co-working Space, Coworking Space). */
const nameKeyOf = (name: string): string => closedUp(name.toLowerCase());

/** The ways each group of words is written, grouped by keyOf and written as spellingOf gives. */
const spellingsBy = <Word>(words: readonly Word[], keyOf: (word: Word) => string, spellingOf: (word: Word) => string): Map<string, Set<string>> =>
  words.reduce((groups, word) => groups.set(keyOf(word), (groups.get(keyOf(word)) ?? new Set<string>()).add(spellingOf(word))), new Map<string, Set<string>>());

const SMALL_LETTERS_ONLY = /^[\p{Ll}\d-]+$/u;

/** A cited word in small letters that the dictionary knows (factors): the title's own word, not a name written small. */
const isOrdinaryCitedWord = (word: QuotedWord, isWord: (word: string) => boolean): boolean =>
  word.quoted === "cited" && SMALL_LETTERS_ONLY.test(word.spelling) && isWord(word.spelling);

/**
 * The words without those taken from elsewhere where their way is their own: in a group of one key whose spellings differ only
 * in hyphens, a cited word and a word of a name the document writes one way only; and a cited ordinary word in small letters. spelling is the word with the first letter of each part
 * in small letters; isWord says whether the language's dictionary has a word.
 */
export const withoutQuotedSpellings = <Word extends QuotedWord>(words: readonly Word[], isWord: (word: string) => boolean): Word[] => {
  const closed = spellingsBy(
    words,
    (word) => word.key,
    (word) => closedUp(word.spelling),
  );
  const names = spellingsBy(
    words.filter((word) => word.name !== undefined),
    (word) => nameKeyOf(word.name ?? ""),
    (word) => word.name ?? "",
  );
  const differsInHyphensOnly = (word: Word): boolean => closed.get(word.key)?.size === 1;
  const isOwnWay = (word: Word): boolean => word.quoted === "cited" || names.get(nameKeyOf(word.name ?? ""))?.size === 1;
  return words.filter((word) => word.quoted === undefined || !((differsInHyphensOnly(word) && isOwnWay(word)) || isOrdinaryCitedWord(word, isWord)));
};
