import { readMarkdown, spansOfType } from "./markdown-read.ts";
import { spanOf, type MarkdownNode } from "./markdown-node.ts";
import { maskSpans } from "./mask.ts";
import type { Span } from "./plugin.ts";

/**
 * The text the document's language is guessed from: what the writer wrote in it. Fenced code, inline code, HTML tags
 * and comments, YAML front matter, a site generator's syntax (MDX imports, component lines) and URLs are blanked out.
 * A technical article in Japanese can hold more Latin letters in its code than kana and kanji in its prose. The text
 * between HTML tags is kept: a `<details>` block holds prose. Indented code is kept too: in plain text an indented
 * paragraph is prose, and Markdown would read it as code.
 */

const FENCE = /^ {0,3}(?:```|~~~)/u;
const URL_PATTERN = /\b[a-z][a-z\d+.-]*:\/\/[^\s<>"'`)\]]+/giu;
const NOT_WRITTEN_IN_IT: readonly string[] = ["inlineCode", "yaml"];
const COMMENT_OPEN = "<!--";

const isFenced = (source: string) => (node: MarkdownNode) => {
  const span = spanOf(node);
  return span !== undefined && FENCE.test(source.slice(span.start, span.end));
};

const urlSpans = (source: string): Span[] => [...source.matchAll(URL_PATTERN)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

/** The tags in an HTML node (`<…>`), found with indexOf so that a stray `<` costs one scan, not a backtrack. */
const tagSpans = (source: string, node: Span): Span[] => {
  const spans: Span[] = [];
  let open = source.indexOf("<", node.start);
  while (open !== -1 && open < node.end) {
    const close = source.indexOf(">", open);
    if (close === -1 || close >= node.end) break;
    spans.push({ start: open, end: close + 1 });
    open = source.indexOf("<", close + 1);
  }
  return spans;
};

/** A comment is blanked whole; any other HTML keeps the text between its tags. */
const htmlSpans = (source: string, nodes: readonly Span[]): Span[] =>
  nodes.flatMap((node) => (source.startsWith(COMMENT_OPEN, node.start) ? [node] : tagSpans(source, node)));

export const languageSample = (source: string): string => {
  const { root, syntax } = readMarkdown(source);
  const code = [...spansOfType(root, "code", isFenced(source)), ...NOT_WRITTEN_IN_IT.flatMap((type) => spansOfType(root, type))];
  return maskSpans(source, [...code, ...htmlSpans(source, spansOfType(root, "html")), ...syntax, ...urlSpans(source)]);
};
