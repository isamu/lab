import { type Atom, type AtomKind, type Extraction, type Unread } from "./atom.ts";
import { compareAtoms, type Reformed } from "./match.ts";
import { unwrittenNames } from "./written-names.ts";
import { unstatedChanges } from "./distinct.ts";

/** One document as compared: where it is, how many facts of each kind it states, and what could not be read. */
export type Side = {
  readonly path: string;
  readonly counts: Readonly<Record<AtomKind, number>>;
  readonly unread: readonly Unread[];
};

/** A dropped or added fact, and whether the command line allowed its kind to change. */
export type Change = Atom & { readonly allowed: boolean };

export type Outcome = {
  readonly before: Side;
  readonly after: Side;
  readonly dropped: readonly Change[];
  readonly added: readonly Change[];
  readonly reformed: readonly Reformed[];
  /** No fact dropped or added, other than of a kind allowed to be. */
  readonly ok: boolean;
};

/** Kinds whose facts may be dropped or added on purpose (--allow-dropped, --allow-added). */
export type Allowed = { readonly dropped: ReadonlySet<AtomKind>; readonly added: ReadonlySet<AtomKind> };

const NOTHING_ALLOWED: Allowed = { dropped: new Set(), added: new Set() };

/** How facts are counted: as-stated compares how many times each is stated, distinct only whether it is stated (--distinct). */
export type Counting = "as-stated" | "distinct";

const NO_FACTS: Readonly<Record<AtomKind, number>> = {
  number: 0,
  date: 0,
  time: 0,
  url: 0,
  code: 0,
  name: 0,
  quote: 0,
  heading: 0,
  reference: 0,
  footnote: 0,
};

export const countsOf = (atoms: readonly Atom[]): Record<AtomKind, number> => {
  const counts = { ...NO_FACTS };
  atoms.forEach((atom) => {
    counts[atom.kind] += 1;
  });
  return counts;
};

const sideOf = (path: string, extraction: Extraction): Side => ({ path, counts: countsOf(extraction.atoms), unread: extraction.unread });

const marked = (atoms: readonly Atom[], allowed: ReadonlySet<AtomKind>): Change[] => atoms.map((atom) => ({ ...atom, allowed: allowed.has(atom.kind) }));

export type Compared = { readonly path: string; readonly extraction: Extraction };

/** The changes of one side that the other side does not state: as many times (as-stated), or at all (distinct). */
const changesOf = (changes: readonly Atom[], own: Extraction, other: Extraction, counting: Counting): Atom[] => {
  const unwritten = unwrittenNames(changes, own.atoms, other.nameText);
  return counting === "distinct" ? unstatedChanges(unwritten, other.atoms, other.nameText) : unwritten;
};

/** What `chaff compare` reports: the comparison of two documents' facts, with the allowed kinds set aside. */
export const outcomeOf = (before: Compared, after: Compared, allowed: Allowed = NOTHING_ALLOWED, counting: Counting = "as-stated"): Outcome => {
  const comparison = compareAtoms(before.extraction.atoms, after.extraction.atoms);
  const dropped = marked(changesOf(comparison.dropped, before.extraction, after.extraction, counting), allowed.dropped);
  const added = marked(changesOf(comparison.added, after.extraction, before.extraction, counting), allowed.added);
  return {
    before: sideOf(before.path, before.extraction),
    after: sideOf(after.path, after.extraction),
    dropped,
    added,
    reformed: comparison.reformed,
    ok: [...dropped, ...added].every((change) => change.allowed),
  };
};
