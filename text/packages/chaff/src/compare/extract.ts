import { lineStarts, placeOf } from "../position.ts";
import type { MarkdownNode } from "../markdown-node.ts";
import type { ProseDocument, Span, StructurePatterns } from "../plugin.ts";
import type { Atom, Extraction, Unread } from "./atom.ts";
import { clockTimes } from "./clock-time.ts";
import { factTextOf, type FactText } from "./fact-text.ts";
import { codeAtoms, headingAtoms, urlAtoms } from "./markup-atoms.ts";
import { properNouns, readsProperNouns } from "./proper-nouns.ts";
import { factKey, seenTextOf, wholeSpanOf } from "./fact-key.ts";
import { spanIndex } from "./spans.ts";
import { atomsOf, bareNumbers, footnotes, numericDates, quotations, teamNames, type TextInput } from "./text-atoms.ts";
import { treeFacts, type TreeFacts } from "./tree-atoms.ts";

export type ExtractInput = {
  readonly doc: ProseDocument;
  /** The Markdown tree, or undefined for a plain-text document. */
  readonly root: MarkdownNode | undefined;
  /** The language package's structure reader: numbers with units, dates and references come from it. */
  readonly structure: StructurePatterns | undefined;
  /** chaff.yaml's `names:`. */
  readonly names: readonly string[];
};

const NO_TREE_FACTS: TreeFacts = { atoms: [], taken: [] };

const STRUCTURE_KINDS = ["number", "date", "reference"] as const;

/** The kinds this document could not be fully read for. Each says why, so "nothing dropped" is never "nothing read". */
const unreadOf = (input: ExtractInput): Unread[] => [
  ...(input.structure === undefined ? STRUCTURE_KINDS.map((kind): Unread => ({ kind, reason: "no-structure" })) : []),
  ...(input.structure !== undefined && input.structure.dates === undefined ? [{ kind: "date", reason: "no-dates" } as const] : []),
  ...(readsProperNouns(input.doc) ? [] : [{ kind: "name", reason: "no-pos" } as const]),
  ...(input.root === undefined ? [{ kind: "code", reason: "plain-text" } as const] : []),
];

type Readers = { readonly facts: FactText; readonly text: TextInput; readonly lineOf: (offset: number) => number };

/** Facts read from the prose itself. Each reader skips what an earlier one took, so one figure is one fact. */
const proseFacts = (input: ExtractInput, readers: Readers, tree: TreeFacts, times: readonly Span[]): Atom[] => {
  const { facts, text, lineOf } = readers;
  const marks = footnotes(facts.codeless);
  const dates = numericDates(facts.text, spanIndex([...tree.taken, ...times]));
  const seen = seenTextOf(facts.text, facts.unseen);
  const names = teamNames(seen.text, input.names).map((found) => wholeSpanOf(seen, found));
  const taken = [...tree.taken, ...times, ...marks, ...dates];
  return [
    ...atomsOf(dates, "date", text),
    ...atomsOf(marks, "footnote", text),
    ...atomsOf(names, "name", text),
    ...bareNumbers(text, spanIndex([...taken, ...facts.listMarkers])),
    ...quotations(text, facts.unseen),
    // "April" in a date and "Section" in a reference are read with them, not again as names.
    ...properNouns({ doc: input.doc, taken: spanIndex([...taken, ...names, ...facts.blanked]), lineOf, unseen: facts.unseen }),
  ];
};

const structureFacts = (input: ExtractInput, facts: FactText, times: readonly Span[], lineOf: (offset: number) => number): TreeFacts => {
  const tree = input.doc.structure;
  return tree === undefined ? NO_TREE_FACTS : treeFacts({ tree, source: input.doc.source, blanked: facts.blanked, times: spanIndex(times), lineOf });
};

/** Every fact atom of one document, and the kinds it could not be fully read for. */
export const extractFacts = (input: ExtractInput): Extraction => {
  const source = input.doc.source;
  const starts = lineStarts(source);
  const lineOf = (offset: number): number => placeOf(starts, offset).line;
  const facts = factTextOf(source, input.root);
  const text = { text: facts.text, source, lineOf };
  const times = clockTimes(facts.text);
  const tree = structureFacts(input, facts, times, lineOf);
  const atoms = [
    ...tree.atoms,
    ...atomsOf(times, "time", text),
    ...proseFacts(input, { facts, text, lineOf }, tree, times),
    ...urlAtoms(input.doc.markup, facts.bareUrls, lineOf),
    ...(input.root === undefined ? [] : codeAtoms(input.root, lineOf)),
    ...headingAtoms(input.doc.markup, lineOf),
  ];
  return { atoms, unread: unreadOf(input), nameText: factKey(facts.text, { start: 0, end: source.length }, facts.unseen) };
};
