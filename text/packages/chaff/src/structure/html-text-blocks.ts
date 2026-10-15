import { readMarkdown } from "../markdown-read.ts";
import { spanOf, type MarkdownNode } from "../markdown-node.ts";
import type { Span } from "../plugin.ts";

const COMMENT = /<!--[\s\S]*?(?:-->|$)/gu;
const INLINE_CONTAINERS = new Set(["paragraph", "heading", "tableCell"]);
const ENTITY = /&(?:#\d+|#x[\da-f]+|[a-z]+\d*);/giu;

type TagScan = { readonly kept: string[]; inTag: boolean; quote: string | undefined };

/** Reads one character of HTML: text outside a tag is kept. A quoted attribute may hold `>` (`<div title=">">`). */
const scanned = (scan: TagScan, char: string): TagScan => {
  if (!scan.inTag) {
    if (char === "<") scan.inTag = true;
    else scan.kept.push(char);
  } else if (scan.quote !== undefined) {
    if (char === scan.quote) scan.quote = undefined;
  } else if (char === '"' || char === "'") scan.quote = char;
  else if (char === ">") scan.inTag = false;
  return scan;
};

const withoutTags = (html: string): string => [...html].reduce<TagScan>(scanned, { kept: [], inTag: false, quote: undefined }).kept.join("");

/** What an HTML block shows the reader: its text without tags, comments and character references such as `&nbsp;`. */
const showsText = (html: string): boolean => withoutTags(html.replace(COMMENT, "")).replace(ENTITY, "").trim() !== "";

/**
 * Markdown's HTML blocks that show text. CommonMark runs a block that starts with a tag alone on its line (`<br/>`) to
 * the next blank line, so a `第11条` written right under it is raw HTML: the reader sees it, chaff's structure does not.
 * Only blocks are returned; an inline tag inside a paragraph (`text<br/>`) leaves the text beside it readable.
 */
export const htmlTextBlocks = (source: string): Span[] => {
  if (!source.includes("<")) return [];
  const blocks: Span[] = [];
  const visit = (node: MarkdownNode, inParagraph: boolean): void => {
    if (node.type === "html" && !inParagraph && showsText(node.value ?? "")) {
      const span = spanOf(node);
      if (span !== undefined) blocks.push(span);
    }
    (node.children ?? []).forEach((child) => visit(child, inParagraph || INLINE_CONTAINERS.has(node.type)));
  };
  visit(readMarkdown(source).root, false);
  return blocks.toSorted((left, right) => left.start - right.start);
};
