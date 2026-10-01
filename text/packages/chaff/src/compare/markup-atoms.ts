import { spanOf, type MarkdownNode } from "../markdown-node.ts";
import { eachPreOrder } from "../tree-walk.ts";
import type { Markup } from "../plugin.ts";
import type { BareUrl } from "../bare-url.ts";
import type { Atom } from "./atom.ts";

const CODE = new Set(["code", "inlineCode"]);

/** Inline code and code blocks, compared as written: the key is the code itself, without its backticks or fences. */
export const codeAtoms = (root: MarkdownNode, lineOf: (offset: number) => number): Atom[] => {
  const found: Atom[] = [];
  eachPreOrder(root, (node) => {
    const span = spanOf(node);
    if (!CODE.has(node.type) || span === undefined) return;
    const code = node.value ?? "";
    found.push({ kind: "code", key: code, text: code, line: lineOf(span.start) });
  });
  return found;
};

/** Where links point (a Markdown link, an autolink, a used reference definition) and URLs written bare. */
export const urlAtoms = (markup: Markup | undefined, bare: readonly BareUrl[], lineOf: (offset: number) => number): Atom[] => [
  ...(markup?.links ?? []).map((link) => ({ kind: "url" as const, key: link.destination, text: link.destination, line: lineOf(link.start) })),
  ...bare.map((url) => ({ kind: "url" as const, key: url.url, text: url.url, line: lineOf(url.start) })),
];

/** Markdown headings as structure: the key is the level, so a reworded heading is the same heading in another form. */
export const headingAtoms = (markup: Markup | undefined, lineOf: (offset: number) => number): Atom[] =>
  (markup?.headings ?? []).map((heading) => ({ kind: "heading", key: "#".repeat(heading.depth), text: heading.text, line: lineOf(heading.start) }));
