import type { Atom } from "./atom.ts";
import { identity } from "./match.ts";

/**
 * What makes two facts the same when only whether a fact is stated counts. A Markdown heading's key is only its level,
 * so the level alone would let any heading at that level stand for a cut one; its wording is part of it here, as it is
 * when facts are counted, where headings first pair by wording.
 */
const statedIdentity = (atom: Atom): string => (atom.kind === "heading" ? `${identity(atom)}\u0000${atom.text}` : identity(atom));

/**
 * The changes left when facts are compared as sets (--distinct): a fact the other document states at least once is
 * kept, however many times either states it. A summary that repeated the body can be cut without its repeats reading
 * as dropped. A name counts as stated when its spelling is in the other document's text (otherNameText), as when
 * names are counted.
 */
export const unstatedChanges = (changes: readonly Atom[], other: readonly Atom[], otherNameText: string): Atom[] => {
  const stated = new Set(other.map(statedIdentity));
  return changes.filter((atom) => !stated.has(statedIdentity(atom)) && !(atom.kind === "name" && otherNameText.includes(atom.key)));
};
