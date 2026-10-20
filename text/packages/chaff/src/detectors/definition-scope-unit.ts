// The unit a definition is made for, read from the words that open its provision: "For the purpose of this subchapter—"
// over a list of definitions in 5 U.S.C. 551. Which words open a scope and which words are units of a code come from the
// language's lexicons (definition-scope-lead, enclosing-unit). Pure.
import type { StructureNode } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";

/** The kinds that hold a provision of their own; the text before the first of them is the provision's opening words. */
const PROVISIONS: ReadonlySet<string> = new Set(["chapter", "article", "item"]);

/** A lead opens a line, a sentence, or the text after a provision's label ("(e) As used in this section—"). */
const LEAD_START = String.raw`(?:^|[.;:]\s+)(?:\([^()\s]{1,5}\)\s*)?`;

type Tree = {
  readonly parents: ReadonlyMap<StructureNode, StructureNode>;
  readonly definitions: ReadonlyMap<number, StructureNode>;
  /** The first word of every provision's label, lower case: "chapter" for "Chapter 35". */
  readonly labels: ReadonlySet<string>;
};

const firstWord = (label: string): string => label.trim().split(/\s/u)[0]?.toLowerCase() ?? "";

/** Every node's parent, the definitions by where they start, and the provisions' label words. One pass, without recursion. */
const indexOf = (tree: StructureNode): Tree => {
  const parents = new Map<StructureNode, StructureNode>();
  const definitions = new Map<number, StructureNode>();
  const labels = new Set<string>();
  const pending: StructureNode[] = [tree];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;
    if (node.kind === "definition") definitions.set(node.span.start, node);
    if (PROVISIONS.has(node.kind)) labels.add(firstWord(String(node.attrs["label"] ?? "")));
    node.children.forEach((child) => parents.set(child, node));
    pending.push(...node.children);
  }
  return { parents, definitions, labels };
};

/** What a node says before its first provision, and before the next node on the way down to the definition. */
const openingOf = (node: StructureNode, next: StructureNode, source: string): string => {
  const firstProvision = node.children.find((child) => PROVISIONS.has(child.kind))?.span.start ?? next.span.start;
  return source.slice(node.span.start, Math.min(firstProvision, next.span.start));
};

/** The pattern of a lead and the unit word after it, or undefined when the language lists no lead. */
const leadPattern = (leads: readonly string[]): RegExp | undefined =>
  leads.length === 0 ? undefined : new RegExp(String.raw`${LEAD_START}(?:${leads.map(escapeRegExp).join("|")})\s+(?<unit>\p{L}+)(?![\p{L}\p{N}])`, "mu");

/** The unit named by the nearest provision around `definition` that opens a scope, lower case, or undefined. */
const unitAround = (definition: StructureNode, tree: Tree, source: string, pattern: RegExp): string | undefined => {
  for (let next = definition, node = tree.parents.get(definition); node !== undefined; next = node, node = tree.parents.get(node)) {
    const unit = pattern.exec(openingOf(node, next, source))?.groups?.["unit"];
    if (unit !== undefined) return unit.toLowerCase();
  }
  return undefined;
};

/**
 * Reads, for the definition at an offset, the unit it is made for (undefined when none). Built once per document: an
 * unused-definition run asks for every unused term.
 */
const unitReader = (index: Tree, source: string, leads: readonly string[]): ((offset: number) => string | undefined) => {
  const pattern = leadPattern(leads);
  return (offset) => {
    const definition = index.definitions.get(offset);
    return pattern === undefined || definition === undefined ? undefined : unitAround(definition, index, source, pattern);
  };
};

export const definitionScopeReader = (tree: StructureNode, source: string, leads: readonly string[]): ((offset: number) => string | undefined) =>
  unitReader(indexOf(tree), source, leads);

/**
 * Whether the definition at an offset is made for a unit of a code (one of `units`) that the document does not have: no
 * chapter, article or item of its tree is labelled with that word. A document that is one section of the unit holds only
 * part of the uses.
 */
export const scopedBeyondReader = (
  tree: StructureNode,
  source: string,
  leads: readonly string[],
  units: ReadonlySet<string>,
): ((offset: number) => boolean) => {
  const index = indexOf(tree);
  const unitOf = unitReader(index, source, leads);
  return (offset) => {
    const unit = unitOf(offset);
    return unit !== undefined && units.has(unit) && !index.labels.has(unit);
  };
};
