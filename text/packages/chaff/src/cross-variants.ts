// One word written one way in some files of a run and another way in the others (サーバ / サーバー, e-mail / email).
// Pure: the words come in already read from each document, each with the key both spellings share.
import { tallyVotes, type Vote } from "./cross-votes.ts";

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
const votesOf = (usages: readonly Usage[]): Vote<string>[] =>
  usages.flatMap((usage) => {
    const [form] = usage.forms;
    return usage.forms.size === 1 && form !== undefined ? [{ path: usage.path, value: form }] : [];
  });

const oddAmong = (usages: readonly Usage[]): OddSpelling[] => {
  const tally = tallyVotes(votesOf(usages), (left, right) => left === right);
  const [example] = tally?.usual ?? [];
  if (tally === undefined || example === undefined) return [];
  const firstIn = new Map(usages.map((usage) => [usage.path, usage.first]));
  return tally.odd.flatMap((vote) => {
    const word = firstIn.get(vote.path);
    return word === undefined ? [] : [{ path: vote.path, word, usual: example.value, files: tally.usual.length, example: example.path }];
  });
};

/**
 * The files that write a word unlike the rest of the run. Each file that writes a word one way votes for that way; a file
 * writing it both ways does not vote. When the votes split, every file outside the usual way is reported once per word,
 * at the first place it writes it.
 */
export const oddSpellings = (docs: readonly DocumentWords[]): OddSpelling[] => [...usagesByKey(docs).values()].flatMap(oddAmong);
