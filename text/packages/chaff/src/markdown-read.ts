import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmTable } from "micromark-extension-gfm-table";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { frontmatter } from "micromark-extension-frontmatter";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { maskSpans } from "./mask.ts";
import { spanOf, type MarkdownNode } from "./markdown-node.ts";
import { componentLines, moduleBlocks, templateSpans } from "./template-syntax.ts";
import { eachPreOrder } from "./tree-walk.ts";
import type { Span } from "./plugin.ts";

export const parse = (source: string): MarkdownNode =>
  fromMarkdown(source, { extensions: [gfmTable(), frontmatter(["yaml"])], mdastExtensions: [gfmTableFromMarkdown(), frontmatterFromMarkdown(["yaml"])] });

export const spansOfType = (root: MarkdownNode, type: string, keep: (node: MarkdownNode) => boolean = () => true): Span[] => {
  const found: Span[] = [];
  eachPreOrder(root, (node) => {
    if (node.type !== type || !keep(node)) return;
    const span = spanOf(node);
    if (span !== undefined) found.push(span);
  });
  return found;
};

/** 番号を探してはいけない範囲。コードの中の「第3条」は条ではなく、参照でもない。 */
const OPAQUE = ["code", "inlineCode", "html", "yaml", "toml"];

export const opaqueSpans = (root: MarkdownNode): Span[] => OPAQUE.flatMap((type) => spansOfType(root, type));

/** Template syntax outside code: a `{{` in backticks is code, and does not open a tag that runs to the next `}}`. */
const templateOf = (root: MarkdownNode, source: string): Span[] => (source.includes("{") ? templateSpans(maskSpans(source, opaqueSpans(root))) : []);

type MarkdownRead = { readonly root: MarkdownNode; readonly syntax: readonly Span[] };

/**
 * Markdown as MDX reads it: a line of nothing but JSX tags is a block of its own, not the start of an HTML block.
 * `syntax` is the site generator's markup in it (those lines, MDX's imports and exports, and template tags outside
 * code), which is neither prose nor structure.
 */
export const readMarkdown = (source: string): MarkdownRead => {
  const components = source.includes("<") ? componentLines(source) : [];
  const root = parse(components.length === 0 ? source : maskSpans(source, components));
  return { root, syntax: [...components, ...moduleBlocks(root, source), ...templateOf(root, source)] };
};
