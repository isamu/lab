// The unit a definition is made for, read from the words that open its provision: "For the purpose of this subchapter—"
// over a list of definitions in 5 U.S.C. 551. Which words open a scope and which words are units of a code come from the
// language's lexicons (definition-scope-lead, enclosing-unit). Pure.
import type { StructureNode } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";

/** The kinds that hold a provision of their own; the text before the first of them is the provision's opening words. */
const PROVISIONS: ReadonlySet<string> = new Set(["chapter", "article", "item"]);

/** The nodes from the root down to the definition that starts at `offset`, or undefined when there is none. */
const pathTo = (tree: StructureNode, offset: number): readonly StructureNode[] | undefined => {
  const pending: StructureNode[][] = [[tree]];
  while (pending.length > 0) {
    const path = pending.pop() ?? [];
    const node = path.at(-1);
    if (node?.kind === "definition" && node.span.start === offset) return path;
    node?.children.filter((child) => child.span.start <= offset).forEach((child) => pending.push([...path, child]));
  }
  return undefined;
};

/** What a node says before its first provision, and before the next node on the path. */
const openingOf = (node: StructureNode, next: StructureNode, source: string): string => {
  const firstProvision = node.children.find((child) => PROVISIONS.has(child.kind))?.span.start ?? next.span.start;
  return source.slice(node.span.start, Math.min(firstProvision, next.span.start));
};

/** The unit word right after one of the leads in `text` ("subchapter" after "For the purpose of this"), lower case. */
const leadUnit = (text: string, leads: readonly string[]): string | undefined => {
  if (leads.length === 0) return undefined;
  const pattern = new RegExp(String.raw`(?:${leads.map(escapeRegExp).join("|")})\s+(?<unit>\p{L}+)(?![\p{L}\p{N}])`, "u");
  return pattern.exec(text)?.groups?.["unit"]?.toLowerCase();
};

/** The unit named by the nearest provision around the definition at `offset` that opens a scope, or undefined. */
export const definitionScopeUnit = (tree: StructureNode, source: string, offset: number, leads: readonly string[]): string | undefined => {
  const path = pathTo(tree, offset) ?? [];
  const openings = path.slice(0, -1).map((node, index) => openingOf(node, path[index + 1] ?? node, source));
  return openings.toReversed().reduce<string | undefined>((found, opening) => found ?? leadUnit(opening, leads), undefined);
};

const firstWord = (label: string): string => label.trim().split(/\s/u)[0]?.toLowerCase() ?? "";

/**
 * Whether a definition is made for a unit of a code (one of `units`) that the document does not have: no chapter, article
 * or item of its tree is labelled with that word. A document that is one section of the unit holds only part of the uses.
 */
export const scopedBeyondDocument = (tree: StructureNode, source: string, offset: number, leads: readonly string[], units: ReadonlySet<string>): boolean => {
  const unit = definitionScopeUnit(tree, source, offset, leads);
  if (unit === undefined || !units.has(unit)) return false;
  const pending: StructureNode[] = [tree];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;
    if (PROVISIONS.has(node.kind) && firstWord(String(node.attrs["label"] ?? "")) === unit) return false;
    pending.push(...node.children);
  }
  return true;
};
