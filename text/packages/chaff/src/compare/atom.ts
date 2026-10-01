/** The kinds of fact `chaff compare` reads, in the order it reports them. */
export const ATOM_KINDS = ["number", "date", "time", "url", "code", "name", "quote", "heading", "reference", "footnote"] as const;

export type AtomKind = (typeof ATOM_KINDS)[number];

export const isAtomKind = (value: string): value is AtomKind => ATOM_KINDS.some((kind) => kind === value);

/**
 * One fact as a document states it. Two atoms are the same fact when kind and key are equal; `text` is how it was
 * written (1,000円 and 1000円 share a key). Position is only for showing where it is: comparing ignores it.
 */
export type Atom = {
  readonly kind: AtomKind;
  readonly key: string;
  readonly text: string;
  readonly line: number;
  /** A number written with no unit the reader knows. It may stand for the same number written with a unit. */
  readonly unitless?: boolean;
  /** For a number: its value alone, without the unit. */
  readonly value?: string;
};

/** A kind this document could not be fully read for, and why. Zero facts of it then does not mean none were there. */
export type Unread = { readonly kind: AtomKind; readonly reason: UnreadReason };

export type UnreadReason = "no-structure" | "no-dates" | "no-pos" | "plain-text";

export type Extraction = {
  readonly atoms: readonly Atom[];
  readonly unread: readonly Unread[];
  /** The prose spelled as name keys are, so the other document can ask whether a name is written here at all. */
  readonly nameText: string;
};
