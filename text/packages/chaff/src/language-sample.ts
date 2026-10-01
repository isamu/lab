import { parse, spansOfType } from "./markdown-read.ts";
import { spanOf, type MarkdownNode } from "./markdown-node.ts";
import { maskSpans } from "./mask.ts";
import type { Span } from "./plugin.ts";

/**
 * The text the document's language is guessed from: what the writer wrote in it. Fenced code, inline code, HTML
 * (comments included), front matter and URLs are blanked out. A technical article in Japanese can hold more Latin
 * letters in its code than kana and kanji in its prose. Indented code is kept: in plain text an indented paragraph is
 * prose, and Markdown would read it as code.
 */

const FENCE = /^ {0,3}(?:```|~~~)/u;
const URL_PATTERN = /\b[a-z][a-z\d+.-]*:\/\/[^\s<>"'`)\]]+/giu;
const NOT_WRITTEN_IN_IT: readonly string[] = ["inlineCode", "html", "yaml", "toml"];

const isFenced = (source: string) => (node: MarkdownNode) => {
  const span = spanOf(node);
  return span !== undefined && FENCE.test(source.slice(span.start, span.end));
};

const urlSpans = (source: string): Span[] => [...source.matchAll(URL_PATTERN)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

export const languageSample = (source: string): string => {
  const root = parse(source);
  const code = [...spansOfType(root, "code", isFenced(source)), ...NOT_WRITTEN_IN_IT.flatMap((type) => spansOfType(root, type))];
  return maskSpans(source, [...code, ...urlSpans(source)]);
};
