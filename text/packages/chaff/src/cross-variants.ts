// One word written one way in some files of a run and another way in the others (サーバ / サーバー, e-mail / email).
// Pure: the words come in already read from each document, each with the key both spellings share.

/** One written word: the key both its spellings share, the spelling as written (in a form that compares), and where. */
export type KeyedWord = { readonly key: string; readonly form: string; readonly offset: number };

/** A document's keyed words, by its path. */
export type DocumentWords = { readonly path: string; readonly words: readonly KeyedWord[] };

/** A file that spells a word unlike the run: its first such word, the usual form, how many files use it, and one of them. */
export type OddSpelling = { readonly path: string; readonly word: KeyedWord; readonly usual: string; readonly files: number; readonly example: string };

/** How one file writes one key: the forms it uses, and the first place it writes it. */
type Usage = { readonly path: string; readonly forms: Set<string>; readonly first: KeyedWord };

/** Each key's usage, file by file in the run's order, read in one pass. */
const usagesByKey = (docs: readonly DocumentWords[]): Map<string, Usage[]> => {
  const byKey = new Map<string, Usage[]>();
  docs.forEach((doc) => {
    const mine = new Map<string, Usage>();
    doc.words.forEach((word) => {
      const usage = mine.get(word.key) ?? { path: doc.path, forms: new Set<string>(), first: word };
      usage.forms.add(word.form);
      mine.set(word.key, usage);
    });
    mine.forEach((usage, key) => byKey.set(key, [...(byKey.get(key) ?? []), usage]));
  });
  return byKey;
};

/** A file's vote: the one form it writes the key in. A file writing it two ways does not vote (its own rules point at that). */
type Vote = { readonly usage: Usage; readonly form: string };

const votesOf = (usages: readonly Usage[]): Vote[] =>
  usages.flatMap((usage) => {
    const [form] = usage.forms;
    return usage.forms.size === 1 && form !== undefined ? [{ usage, form }] : [];
  });

/** The form most files use; on a tie, the form of the first of those files in the run's order. */
const usualOf = (votes: readonly Vote[]): string | undefined => {
  const counts = new Map<string, number>();
  votes.forEach((vote) => counts.set(vote.form, (counts.get(vote.form) ?? 0) + 1));
  const most = Math.max(...counts.values());
  return votes.find((vote) => counts.get(vote.form) === most)?.form;
};

const oddAmong = (usages: readonly Usage[]): OddSpelling[] => {
  const votes = votesOf(usages);
  const usual = usualOf(votes);
  const usualVotes = votes.filter((vote) => vote.form === usual);
  const example = usualVotes[0]?.usage.path;
  if (usual === undefined || example === undefined) return [];
  return votes
    .filter((vote) => vote.form !== usual)
    .map((vote) => ({ path: vote.usage.path, word: vote.usage.first, usual, files: usualVotes.length, example }));
};

/**
 * The files that write a word unlike the rest of the run. Each file that writes a word one way votes for that way; a file
 * writing it both ways does not vote. When the votes split, every file outside the usual way is reported once per word,
 * at the first place it writes it.
 */
export const oddSpellings = (docs: readonly DocumentWords[]): OddSpelling[] => [...usagesByKey(docs).values()].flatMap(oddAmong);
