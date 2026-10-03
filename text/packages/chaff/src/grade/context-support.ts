import type { Atom, AtomKind, Extraction, UnreadReason } from "../compare/atom.ts";
import { outcomeOf } from "../compare/outcome.ts";
import type { GradeFact, SupportedFact } from "./result.ts";

// Whether each checkable fact of an answer is stated in some retrieved passage (spec §29.3, contexts). Pure. Facts are
// read and matched as `chaff compare --distinct` matches them; a quotation must be in a passage word for word. Meaning
// is never judged: a sentence with no checkable fact is counted as not checked, not as supported.

/** The kinds an answer is checked for. Headings, clause references and footnotes describe the answer, not the world. */
export const CONTEXT_KINDS: readonly AtomKind[] = ["number", "date", "time", "url", "code", "name", "quote"];

/** A kind not fully read in the answer or a passage, and why: no fact of it found there is not "none". */
export type UnreadKind = { readonly kind: AtomKind; readonly reason: UnreadReason };

export type ContextSupport = {
  readonly checked: number;
  readonly supported: readonly SupportedFact[];
  readonly unsupported: readonly GradeFact[];
  readonly unread: readonly UnreadKind[];
};

/** One passage as read: its facts, and its text to find a quotation in. */
export type Passage = { readonly extraction: Extraction; readonly text: string };

/** Text as a quotation key spells it: width and runs of white space are how it is written, not what it says. */
const spelled = (text: string): string => text.normalize("NFKC").replace(/\s+/gu, " ");

const factId = (atom: Atom): string => [atom.kind, atom.key, String(atom.line), atom.text].join("\u0000");

/** The facts of the answer this passage states: a quotation word for word, any other fact as compare --distinct keeps it. */
const statedIn = (answer: Extraction, passage: Passage): ReadonlySet<string> => {
  const unstated = new Set(
    outcomeOf({ path: "context", extraction: passage.extraction }, { path: "answer", extraction: answer }, undefined, "distinct").added.map(factId),
  );
  const text = spelled(passage.text);
  return new Set(answer.atoms.filter((atom) => (atom.kind === "quote" ? text.includes(atom.key) : !unstated.has(factId(atom)))).map(factId));
};

const unreadOf = (extractions: readonly Extraction[]): UnreadKind[] => {
  const seen = new Map<string, UnreadKind>();
  extractions.forEach((extraction) =>
    extraction.unread.filter((entry) => CONTEXT_KINDS.includes(entry.kind)).forEach((entry) => seen.set(`${entry.kind}\n${entry.reason}`, entry)),
  );
  return [...seen.values()];
};

/** Each checkable fact of the answer, supported by the first passage that states it, or unsupported. `allowed`: kinds that may be. */
export const contextSupport = (answer: Extraction, passages: readonly Passage[], allowed: ReadonlySet<AtomKind>): ContextSupport => {
  const stated = passages.map((passage) => statedIn(answer, passage));
  const checked = answer.atoms.filter((atom) => CONTEXT_KINDS.includes(atom.kind));
  const placed = checked.map((atom) => ({ atom, passage: stated.findIndex((ids) => ids.has(factId(atom))) }));
  return {
    checked: checked.length,
    supported: placed.flatMap(({ atom, passage }) => (passage === -1 ? [] : [{ kind: atom.kind, text: atom.text, line: atom.line, passage }])),
    unsupported: placed.flatMap(({ atom, passage }) =>
      passage === -1 ? [{ kind: atom.kind, key: atom.key, text: atom.text, line: atom.line, allowed: allowed.has(atom.kind) }] : [],
    ),
    unread: unreadOf([answer, ...passages.map((passage) => passage.extraction)]),
  };
};
