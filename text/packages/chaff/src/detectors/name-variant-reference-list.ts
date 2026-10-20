// A reference list names each work's own authors: two surnames a letter apart there (Tsang and Tseng, Freedman and
// Friedman) are two people, not one name written two ways. A name is read as an author by its initials beside it
// ("A. Freedman", "Freedman, A."); a journal's misspelt name (Occupatiional) has none and is still reported. Pure.
import type { ProseDocument, Span } from "../plugin.ts";
import { referenceListSpans } from "../reference-lists.ts";

/** The kinds that tell two Latin names apart by a letter or by a surname's letters. */
const ANOTHER_PERSON_KINDS: ReadonlySet<string> = new Set(["near", "surname"]);

/** Initials just before a surname, each with its space: "A. ", "P. B. ", "J.-P. "; not "U.S. ". */
const INITIALS_BEFORE = /(?:^|[\s(,;])(?:\p{Lu}\.(?:-\p{Lu}\.)?[ \u00a0]){1,3}$/u;
/** Initials just after a surname: "Freedman, A." */
const INITIALS_AFTER = /^,[ \u00a0]\p{Lu}\./u;

const REACH = 24;

/** Whether the name at offset has initials on one side, as an author's name in a reference entry does. */
export const isAuthorName = (source: string, offset: number, length: number): boolean =>
  INITIALS_BEFORE.test(source.slice(Math.max(0, offset - REACH), offset)) || INITIALS_AFTER.test(source.slice(offset + length, offset + length + REACH));

type Reported = { readonly offset: number; readonly name: string; readonly kind: string };

/** Whether a reported name is another author's name in a reference list rather than a slip. */
export const isAnotherAuthor = (source: string, found: Reported, referenceLists: readonly Span[]): boolean =>
  ANOTHER_PERSON_KINDS.has(found.kind) &&
  referenceLists.some((list) => list.start <= found.offset && found.offset < list.end) &&
  isAuthorName(source, found.offset, found.name.length);

/** A filter keeping every reported name but another author's in the document's reference lists. */
export const notAnotherAuthorIn = (doc: ProseDocument): ((found: Reported) => boolean) => {
  const headings = (doc.lexicons["reference-list-heading"] ?? []).map((entry) => entry.pattern);
  const referenceLists = referenceListSpans(doc.source, headings);
  return (found) => !isAnotherAuthor(doc.source, found, referenceLists);
};
