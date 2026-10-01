import type { Atom } from "./atom.ts";
import { identity } from "./match.ts";

/**
 * The changes left when facts are compared as sets (--distinct): a fact the other document states at least once is
 * kept, however many times either states it. A summary that repeated the body can be cut without its repeats reading
 * as dropped. A name counts as stated when its spelling is in the other document's text (otherNameText), as when
 * names are counted.
 */
export const unstatedChanges = (changes: readonly Atom[], other: readonly Atom[], otherNameText: string): Atom[] => {
  const stated = new Set(other.map(identity));
  return changes.filter((atom) => !stated.has(identity(atom)) && !(atom.kind === "name" && otherNameText.includes(atom.key)));
};
