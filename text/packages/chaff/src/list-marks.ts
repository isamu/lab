// The bullets a document writes its lists with (`-`, `*`, `+`, and `・` typed at a line's start), where each list sits, and
// the `・` lines Markdown folds into the item above. Pure; reads the source's Markdown tree.
import { spanOf, type MarkdownNode } from "./markdown-node.ts";
import type { Span } from "./plugin.ts";

/** One bulleted list as the reader meets it: where its first item starts, how deep it sits among lists, and its bullet. */
export type ListMark = {
  readonly start: number;
  readonly depth: number;
  readonly mark: string;
  /** The list written right before it in the same parent, when there is one: Markdown splits a list where the bullet changes. */
  readonly previous: string | undefined;
};

/** Bullets Markdown reads as a list. */
const MARKDOWN_BULLETS = new Set(["-", "*", "+"]);

/** A bullet a Japanese writer types at a line's start. Markdown does not read it as a list, so the lines run together. */
const TYPED_BULLET = "・";

/** Blocks whose lists are someone else's or are not prose: quotations, code and HTML. */
const SKIPPED = new Set(["blockquote", "code", "html"]);

const bulletOf = (source: string, list: MarkdownNode): { readonly start: number; readonly mark: string } | undefined => {
  const first = list.children?.[0];
  const span = first === undefined ? undefined : spanOf(first);
  const mark = span === undefined ? undefined : source.charAt(span.start);
  return span === undefined || mark === undefined || !MARKDOWN_BULLETS.has(mark) ? undefined : { start: span.start, mark };
};

/** Where each line of a span starts, with the line's text. */
const linesIn = (source: string, span: Span): { readonly start: number; readonly text: string }[] => {
  const lines = source.slice(span.start, span.end).split("\n");
  const read: { start: number; text: string }[] = [];
  lines.forEach((text) => {
    const previous = read.at(-1);
    read.push({ start: previous === undefined ? span.start : previous.start + previous.text.length + 1, text });
  });
  return read;
};

/** The start of each line after the first that begins with a typed bullet. */
const typedLineStarts = (source: string, paragraph: Span): number[] =>
  linesIn(source, paragraph).flatMap((line, at) => {
    const indent = line.text.length - line.text.trimStart().length;
    return at > 0 && line.text.trimStart().startsWith(TYPED_BULLET) ? [line.start + indent] : [];
  });

/** Lines of a paragraph that start with a typed bullet; two or more in a row are a list the writer typed. */
const typedListStart = (source: string, paragraph: Span): number | undefined => {
  const lines = linesIn(source, paragraph).filter((line) => line.text.trim() !== "");
  const typed = lines.filter((line) => line.text.trimStart().startsWith(TYPED_BULLET));
  const first = typed[0];
  return typed.length >= 2 && first !== undefined ? first.start + first.text.length - first.text.trimStart().length : undefined;
};

type Frame = { readonly node: MarkdownNode; readonly depth: number; readonly inItem: boolean };

export type ListReading = {
  readonly lists: readonly ListMark[];
  /** `・` lines inside a Markdown list item's paragraph: Markdown joins them to the item above. */
  readonly foldedTyped: readonly number[];
};

const listsOf = (source: string, node: MarkdownNode, depth: number): ListMark[] => {
  const children = node.children ?? [];
  return children.flatMap((child, at) => {
    if (child.type !== "list") return [];
    const bullet = bulletOf(source, child);
    const before = children[at - 1];
    const previous = before?.type === "list" ? bulletOf(source, before)?.mark : undefined;
    return bullet === undefined ? [] : [{ ...bullet, depth, previous }];
  });
};

const typedOf = (source: string, node: MarkdownNode, depth: number, inItem: boolean): { lists: ListMark[]; folded: number[] } => {
  const span = spanOf(node);
  if (node.type !== "paragraph" || span === undefined) return { lists: [], folded: [] };
  if (inItem) return { lists: [], folded: typedLineStarts(source, span) };
  const start = typedListStart(source, span);
  return { lists: start === undefined ? [] : [{ start, depth, mark: TYPED_BULLET, previous: undefined }], folded: [] };
};

/**
 * Every bulleted list outside quotations and code, with its depth among lists (a list in a list item is one deeper), in source
 * order. A paragraph with two or more lines that start with `・` counts as a list at the paragraph's depth; the same lines in a
 * list item's paragraph are folded into that item.
 */
export const readLists = (source: string, root: MarkdownNode): ListReading => {
  const lists: ListMark[] = [];
  const folded: number[] = [];
  const pending: Frame[] = [{ node: root, depth: 0, inItem: false }];
  for (let frame = pending.pop(); frame !== undefined; frame = pending.pop()) {
    const { node, depth, inItem } = frame;
    if (SKIPPED.has(node.type)) continue;
    lists.push(...listsOf(source, node, depth));
    const typed = typedOf(source, node, depth, inItem);
    lists.push(...typed.lists);
    folded.push(...typed.folded);
    const childDepth = node.type === "list" ? depth + 1 : depth;
    const childInItem = node.type === "listItem" || (inItem && node.type !== "list");
    (node.children ?? []).forEach((child) => pending.push({ node: child, depth: childDepth, inItem: childInItem }));
  }
  const byStart = (left: number, right: number): number => left - right;
  return { lists: lists.toSorted((left, right) => byStart(left.start, right.start)), foldedTyped: folded.toSorted(byStart) };
};
