// Reference-link definitions (`[label]: url`) that do nothing: one no link calls, and a second one for a label already
// defined, which Markdown ignores. Pure; reads the source's Markdown tree.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { readMarkdown } from "../markdown-read.ts";
import { spanOf, type MarkdownNode } from "../markdown-node.ts";
import { findingAt, markupOf } from "./markup-finding.ts";

const QUOTED = "blockquote";
const DEFINITION = "definition";
const CALLS = new Set(["linkReference", "imageReference"]);

/** A definition that is a comment in disguise (`[//]: # (note)`, `[comment]: <>`): it has no address to lose. */
const COMMENT_DESTINATIONS = new Set(["", "#"]);
const COMMENT_LABEL = "//";

/** A note (`[^1]: …`) is read as a definition without the footnote extension; `footnote-mismatch` checks notes. */
const NOTE_MARK = "^";

type Placed = { readonly node: MarkdownNode; readonly previous: MarkdownNode | undefined };

/** Definitions outside quotations, each with the node before it among its siblings. Walks with its own stack. */
const definitionsOf = (root: MarkdownNode): Placed[] => {
  const found: Placed[] = [];
  const pending: MarkdownNode[] = [root];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (node.type === QUOTED) continue;
    const children = node.children ?? [];
    children.forEach((child, index) => {
      if (child.type === DEFINITION) found.push({ node: child, previous: children[index - 1] });
    });
    children.toReversed().forEach((child) => pending.push(child));
  }
  return found;
};

/** Labels a link or an image calls, quotations included: a quoted link still uses the definition. */
const calledLabels = (root: MarkdownNode): Set<string> => {
  const called = new Set<string>();
  const pending: MarkdownNode[] = [root];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (CALLS.has(node.type) && node.identifier !== undefined) called.add(node.identifier);
    (node.children ?? []).forEach((child) => pending.push(child));
  }
  return called;
};

const labelOf = (node: MarkdownNode): string => node.label ?? node.identifier ?? "";

/** Not a link definition at all: a comment, or a note. */
const isNotALink = (node: MarkdownNode): boolean =>
  COMMENT_DESTINATIONS.has((node.url ?? "").trim()) || labelOf(node) === COMMENT_LABEL || labelOf(node).startsWith(NOTE_MARK);

/** A name for the heading just above (`## Summary` then `[summary]: #summary`), as some templates write under every heading. */
const isHeadingAnchor = ({ node, previous }: Placed): boolean => (node.url ?? "").startsWith("#") && previous?.type === "heading";

/** A file of nothing but definitions, which other pages include for their links. */
const isDefinitionFile = (root: MarkdownNode): boolean => {
  const blocks = (root.children ?? []).filter((child) => child.type !== "yaml");
  return blocks.length > 0 && blocks.every((child) => child.type === DEFINITION);
};

const unusedOf = (doc: ProseDocument, definitions: readonly Placed[], called: ReadonlySet<string>): Finding[] =>
  definitions
    .filter((placed) => !called.has(placed.node.identifier ?? "") && !isHeadingAnchor(placed))
    .flatMap(({ node }) => {
      const span = spanOf(node);
      return span === undefined ? [] : [findingAt(doc, span, { label: labelOf(node) }, "unused")];
    });

/** A later definition of a label already defined with another address: Markdown keeps the first and ignores this one. */
const duplicatesOf = (doc: ProseDocument, definitions: readonly Placed[]): Finding[] => {
  const first = new Map<string, MarkdownNode>();
  return definitions.flatMap(({ node }) => {
    const key = node.identifier ?? "";
    const earlier = first.get(key);
    if (earlier === undefined) first.set(key, node);
    const span = spanOf(node);
    if (earlier === undefined || earlier.url === node.url || span === undefined) return [];
    return [findingAt(doc, span, { label: labelOf(node), url: earlier.url ?? "" }, "duplicate")];
  });
};

export const linkDefinitionUnused: Detector = (doc): Finding[] => {
  if (markupOf(doc) === undefined) return [];
  const { root } = readMarkdown(doc.source);
  if (isDefinitionFile(root)) return [];
  const definitions = definitionsOf(root).filter(({ node }) => !isNotALink(node));
  return [...unusedOf(doc, definitions, calledLabels(root)), ...duplicatesOf(doc, definitions)].toSorted(
    (left, right) => Number(left.values["offset"]) - Number(right.values["offset"]),
  );
};
