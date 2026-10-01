import type { Atom } from "./atom.ts";

const occurrences = (text: string, needle: string): number => {
  let count = 0;
  for (let at = text.indexOf(needle); at !== -1 && needle !== ""; at = text.indexOf(needle, at + needle.length)) count += 1;
  return count;
};

const namesPerKey = (atoms: readonly Atom[]): Map<string, number> =>
  atoms.reduce((counts, atom) => (atom.kind === "name" ? counts.set(atom.key, (counts.get(atom.key) ?? 0) + 1) : counts), new Map<string, number>());

/**
 * The names among changes that the other document does not write as often as this one names them. The tagger reads
 * a word as a name by its context (赤松 after から, Scammers before could), so a rewrite can change the tagging without
 * changing the name; the spelling decides. otherText is the other document's prose spelled as name keys are.
 */
export const unwrittenNames = (changes: readonly Atom[], own: readonly Atom[], otherText: string): Atom[] => {
  const named = namesPerKey(own);
  const left = new Map<string, number>();
  return changes.filter((atom) => {
    if (atom.kind !== "name") return true;
    const remaining = left.get(atom.key) ?? Math.max(0, (named.get(atom.key) ?? 0) - occurrences(otherText, atom.key));
    left.set(atom.key, Math.max(0, remaining - 1));
    return remaining > 0;
  });
};
