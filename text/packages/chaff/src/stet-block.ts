import { spanOf, type MarkdownNode } from "./markdown-node.ts";
import type { Span } from "./plugin.ts";

/**
 * Where a `<!-- stet: … -->` (scope next) stops: the end of the block right after the comment, as the Markdown parser
 * reads it — a paragraph, a heading, a whole list, a table, a code block, a quote. Inside a list item, the item's next
 * block. Plain text reads the same way: its paragraphs are the runs between blank lines.
 */

/** Containers whose children are blocks. Anywhere else, an HTML comment sits inside a paragraph or a heading. */
const BLOCK_CONTAINERS: ReadonlySet<string> = new Set(["root", "listItem", "blockquote"]);

type Holder = { readonly parent: MarkdownNode; readonly index: number };

/** 1-based line of an offset. */
export const lineOf = (source: string, offset: number): number => source.slice(0, offset).split("\n").length;

const holds = (node: MarkdownNode, offset: number): boolean => {
  const span = spanOf(node);
  return span !== undefined && span.start <= offset && offset < span.end;
};

/** The deepest node holding `offset`, as its parent and its place among the parent's children. */
const holderOf = (parent: MarkdownNode, offset: number): Holder | undefined => {
  const children = parent.children ?? [];
  const index = children.findIndex((child) => holds(child, offset));
  const child = children[index];
  if (child === undefined) return undefined;
  return holderOf(child, offset) ?? { parent, index };
};

/** The node a stet covers: the next block when the comment stands alone, else the block the comment is part of. */
const coveredNode = (source: string, holder: Holder, comment: Span): MarkdownNode | undefined => {
  const siblings = holder.parent.children ?? [];
  const node = siblings[holder.index];
  if (node === undefined) return undefined;
  if (!BLOCK_CONTAINERS.has(holder.parent.type)) return holder.parent;
  const span = spanOf(node);
  const alone = span !== undefined && source.slice(span.start, span.end).trim() === source.slice(comment.start, comment.end);
  return alone ? siblings[holder.index + 1] : node;
};

/** The last line a `stet` (scope next) covers, for the comment at `comment` in a document parsed as `root`. */
export const stetBlockEnd = (source: string, root: MarkdownNode, comment: Span): number => {
  const closingLine = lineOf(source, comment.end);
  const holder = holderOf(root, comment.start);
  const covered = holder === undefined ? undefined : coveredNode(source, holder, comment);
  const end = covered === undefined ? undefined : spanOf(covered)?.end;
  return end === undefined ? closingLine : lineOf(source, end);
};
