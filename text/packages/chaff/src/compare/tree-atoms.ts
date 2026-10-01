import { preOrder } from "../tree-walk.ts";
import type { Span, StructureNode } from "../plugin.ts";
import type { Atom, AtomKind } from "./atom.ts";
import { coversOffset, overlapsAny, type SpanIndex } from "./spans.ts";

/** Facts the structure reader found, and where they are written, so no other reader reads the same digits again. */
export type TreeFacts = { readonly atoms: readonly Atom[]; readonly taken: readonly Span[] };

export type TreeInput = {
  readonly tree: StructureNode;
  readonly source: string;
  /** Code and URLs: what the reader found there belongs to them. */
  readonly blanked: SpanIndex;
  /** Times of day: 3時30分 is one time, not the quantities 3 時 and 30 分. */
  readonly times: SpanIndex;
  readonly lineOf: (offset: number) => number;
};

/** Numbered units that are the document's own structure. Items (a list's 1. 2. 3.) are left out: prose may replace a list. */
const NUMBERED: ReadonlySet<string> = new Set(["chapter", "article"]);

const attr = (node: StructureNode, name: string): string => String(node.attrs[name] ?? "");

/** The unit as one spelling: ＧＢ and GB, ％ and % are one unit. */
const unitKey = (unit: string): string => unit.normalize("NFKC");

const quantityAtom = (node: StructureNode, text: string, line: number): Atom => {
  const value = attr(node, "value");
  return { kind: "number", key: `${value} ${unitKey(attr(node, "unit"))}`, text, line, value };
};

/** The same section in another wording: Section 4.2 and § 4.2 point at one place; Article 4.2 does not. */
const referenceKey = (node: StructureNode): string => {
  const numbering = attr(node, "numbering") || attr(node, "unitWord");
  const document = attr(node, "document");
  return [numbering, attr(node, "target"), document === "" ? "" : `@${document}`].filter((part) => part !== "").join(" ");
};

const leafAtom = (node: StructureNode, kind: AtomKind, text: string, line: number): Atom => {
  if (kind === "number") return quantityAtom(node, text, line);
  return { kind, key: kind === "date" ? attr(node, "value") : referenceKey(node), text, line };
};

const LEAF_KINDS: Readonly<Partial<Record<string, AtomKind>>> = { quantity: "number", date: "date", reference: "reference" };

/** The label's place on its line (第3条 after "## "), or none when the line does not spell it. */
const labelSpan = (node: StructureNode, source: string): Span[] => {
  const label = attr(node, "label");
  const lineEnd = source.indexOf("\n", node.span.start);
  const at = source.indexOf(label, node.span.start);
  return label === "" || at === -1 || (lineEnd !== -1 && at > lineEnd) ? [] : [{ start: at, end: at + label.length }];
};

const numberedFacts = (node: StructureNode, input: TreeInput): TreeFacts => {
  const heading = attr(node, "heading");
  const text = [attr(node, "label"), heading].filter((part) => part !== "").join(" ");
  return { atoms: [{ kind: "heading", key: `${node.kind} ${node.address}`, text, line: node.line }], taken: labelSpan(node, input.source) };
};

const nodeFacts = (node: StructureNode, input: TreeInput): TreeFacts => {
  if (NUMBERED.has(node.kind)) return numberedFacts(node, input);
  const kind = LEAF_KINDS[node.kind];
  if (kind === undefined || coversOffset(input.blanked, node.span.start)) return { atoms: [], taken: [] };
  if (kind === "number" && overlapsAny(input.times, node.span)) return { atoms: [], taken: [] };
  const span = withUnitAfter(node, input.source);
  const text = input.source.slice(span.start, span.end);
  return { atoms: [leafAtom(node, kind, text, input.lineOf(span.start))], taken: [span] };
};

/** A quantity's span may stop before the unit written right after it (25 of 25%); the fact is shown with its unit. */
const withUnitAfter = (node: StructureNode, source: string): Span => {
  const unit = attr(node, "unit");
  return unit !== "" && source.startsWith(unit, node.span.end) ? { start: node.span.start, end: node.span.end + unit.length } : node.span;
};

/** Numbers with their unit, dates, references to articles and sections, and the numbered articles themselves. */
export const treeFacts = (input: TreeInput): TreeFacts => {
  const facts = preOrder(input.tree).map((node) => nodeFacts(node, input));
  return { atoms: facts.flatMap((fact) => fact.atoms), taken: facts.flatMap((fact) => fact.taken) };
};
