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

/** The child holding `offset`, or -1. Binary search: siblings are in source order, and a document can hold thousands of stets. */
const childHolding = (children: readonly MarkdownNode[], offset: number): number => {
  let low = 0;
  let high = children.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const span = spanOf(children[middle] ?? { type: "" });
    if (span === undefined) return -1;
    if (offset < span.start) high = middle - 1;
    else if (offset >= span.end) low = middle + 1;
    else return middle;
  }
  return -1;
};

/** The deepest node holding `offset`, as its parent and its place among the parent's children. A loop: quotes nest without limit. */
const holderOf = (root: MarkdownNode, offset: number): Holder | undefined => {
  let found: Holder | undefined;
  let parent: MarkdownNode | undefined = root;
  while (parent !== undefined) {
    const children: readonly MarkdownNode[] = parent.children ?? [];
    const index = childHolding(children, offset);
    if (index !== -1) found = { parent, index };
    parent = children[index];
  }
  return found;
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
export const stetBlockEnd = (source: string, root: MarkdownNode, comment: Span, lineAt: (offset: number) => number): number => {
  const holder = holderOf(root, comment.start);
  const covered = holder === undefined ? undefined : coveredNode(source, holder, comment);
  const end = covered === undefined ? undefined : spanOf(covered)?.end;
  return lineAt(end ?? comment.end);
};
