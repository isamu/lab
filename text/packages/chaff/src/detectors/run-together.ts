// A word run together from two long words where a conversion lost the space between them ("Includingspecified" where a
// table's cells met): the dictionary knows both halves and not the whole. Halves this long are not a coined compound
// (crowdwork), which joins short roots. Pure; the dictionary is the language package's word list.

/** The shortest half: below it, two words make a compound a writer may coin (crowdwork, workflow). */
const MIN_HALF = 6;

/** Whether `word` is two dictionary words of at least MIN_HALF letters each run together, and no dictionary word itself. */
export const isRunTogether = (word: string, dictionary: ReadonlySet<string>): boolean => {
  const lower = word.toLowerCase();
  if (!/^\p{L}+$/u.test(lower) || dictionary.has(lower)) return false;
  return Array.from({ length: lower.length - MIN_HALF * 2 + 1 }, (_unused, index) => index + MIN_HALF).some(
    (cut) => dictionary.has(lower.slice(0, cut)) && dictionary.has(lower.slice(cut)),
  );
};
