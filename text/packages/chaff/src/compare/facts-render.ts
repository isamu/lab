import { ATOM_KINDS, type Atom, type AtomKind, type Extraction, type Unread } from "./atom.ts";
import { countsOf } from "./outcome.ts";
import { atomJson, shown } from "./render.ts";
import type { FactsText } from "./facts-text.ts";

/** One document's facts as `chaff facts` lists them. */
export type FactList = { readonly path: string; readonly language: string; readonly extraction: Extraction };

/** Kind by kind in compare's order, and within a kind in the order the document states them. */
export const inChecklistOrder = (atoms: readonly Atom[]): Atom[] =>
  atoms.toSorted((left, right) => ATOM_KINDS.indexOf(left.kind) - ATOM_KINDS.indexOf(right.kind) || left.line - right.line);

/** Every kind with its count, zeros too: an empty kind reads as "none stated", never as "not looked at". */
const perKind = (atoms: readonly Atom[], text: FactsText): string => {
  const counts = countsOf(atoms);
  return ATOM_KINDS.map((kind) => text.kindCount(text.kinds[kind], counts[kind])).join(text.separator);
};

const title = (list: FactList, text: FactsText): string => text.title(list.path, list.extraction.atoms.length, perKind(list.extraction.atoms, text));

const checklistLine = (atom: Atom, path: string): string => `  - [ ] ${shown(atom.text)}  (${path}:${String(atom.line)})`;

const kindBlock = (ordered: readonly Atom[], kind: AtomKind, path: string, text: FactsText): string[] => {
  const ofKind = ordered.filter((atom) => atom.kind === kind);
  return ofKind.length === 0 ? [] : ["", text.kindHeading(text.kinds[kind], ofKind.length), ...ofKind.map((atom) => checklistLine(atom, path))];
};

const unreadBlock = (unread: readonly Unread[], text: FactsText): string[] =>
  unread.length === 0 ? [] : ["", text.unreadHeading, ...unread.map((entry) => `  ${text.unread(entry.kind, entry.reason)}`)];

/** For a person or an AI about to rewrite: a checklist per kind, with the line each fact is on. */
export const renderFactsFriendly = (list: FactList, text: FactsText): string => {
  const ordered = inChecklistOrder(list.extraction.atoms);
  return [
    title(list, text),
    ...ATOM_KINDS.flatMap((kind) => kindBlock(ordered, kind, list.path, text)),
    ...unreadBlock(list.extraction.unread, text),
    "",
    text.next(list.path),
  ].join("\n");
};

/** For grep: one fact per line with the kind in English, then what was not read, then the counts. */
export const renderFactsCompact = (list: FactList, text: FactsText): string =>
  [
    ...inChecklistOrder(list.extraction.atoms).map((atom) => `${list.path}:${String(atom.line)}: ${atom.kind} ${shown(atom.text)}`),
    ...list.extraction.unread.map((entry) => `${list.path}: unread ${entry.kind} (${entry.reason})`),
    title(list, text),
  ].join("\n");

/** For an AI to keep as its inventory: every fact with its kind, key, text and line, and the counts per kind. */
export const renderFactsJson = (list: FactList): string =>
  JSON.stringify(
    {
      path: list.path,
      language: list.language,
      counts: countsOf(list.extraction.atoms),
      unread: list.extraction.unread,
      facts: inChecklistOrder(list.extraction.atoms).map(atomJson),
    },
    null,
    2,
  );
