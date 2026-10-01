import { bareUrls, type BareUrl } from "../bare-url.ts";
import { emphasisSpans, linkChrome } from "../document.ts";
import { opaqueSpans } from "../markdown-read.ts";
import { spanOf, type MarkdownNode } from "../markdown-node.ts";
import { maskSpans } from "../mask.ts";
import { unmaskedSoftBreaks } from "../soft-break.ts";
import { eachPreOrder } from "../tree-walk.ts";
import type { Span } from "../plugin.ts";
import { overlapsAny, spanIndex, type SpanIndex } from "./spans.ts";

/**
 * The document as the facts in prose are read from it: the same length as the source, with what is not prose
 * blanked. Code, HTML and front matter are compared as code or not at all; a link's target and a bare URL are
 * compared as URLs. Blanking them keeps the digits of a URL from being read again as numbers.
 */
export type FactText = {
  /** The source with code and URLs blanked. Offsets are the source's. */
  readonly text: string;
  /** The source with only code blanked: footnote marks are link syntax, so they are read before links are blanked. */
  readonly codeless: string;
  /** Where the blanked parts are. A fact the structure reader found there is not a fact of the prose. */
  readonly blanked: SpanIndex;
  readonly bareUrls: readonly BareUrl[];
  /** Ordered-list markers (`1.`): they number the list, they do not state a number. */
  readonly listMarkers: readonly Span[];
  /**
   * What a reader of the rendered Markdown never sees, sorted: a line break between two wide characters (「系の\nシステム」)
   * and the marks of bold. A plain-text document shows its line breaks, so it has none.
   */
  readonly unseen: readonly Span[];
};

/** Nodes whose whole span is not read as prose: a link reference definition's URL is read as a URL, an image is not text. */
const WHOLE = new Set(["definition", "image", "imageReference"]);
const LINKS = new Set(["link", "linkReference"]);

/** `1.` or `1)` at the start of an ordered list item. */
const ORDERED_MARKER = /^\s*\d{1,9}[.)]/u;

const listMarker = (node: MarkdownNode, source: string): Span[] => {
  const span = spanOf(node);
  if (node.type !== "listItem" || span === undefined) return [];
  const marker = ORDERED_MARKER.exec(source.slice(span.start, span.end));
  return marker === null ? [] : [{ start: span.start, end: span.start + marker[0].length }];
};

type MarkdownParts = { readonly chrome: Span[]; readonly linkSpans: Span[]; readonly listMarkers: Span[] };

const markdownParts = (root: MarkdownNode, source: string): MarkdownParts => {
  const parts: MarkdownParts = { chrome: [], linkSpans: [], listMarkers: [] };
  eachPreOrder(root, (node) => {
    const span = spanOf(node);
    if (span === undefined) return;
    if (WHOLE.has(node.type)) parts.chrome.push(span);
    if (LINKS.has(node.type)) {
      parts.chrome.push(...linkChrome(node));
      parts.linkSpans.push(span);
    }
    parts.listMarkers.push(...listMarker(node, source));
  });
  return parts;
};

/** Line breaks are read the way the rules read them: one next to blanked code or a link's marks is kept. */
const unseenOf = (source: string, text: string, root: MarkdownNode | undefined): Span[] =>
  root === undefined ? [] : [...unmaskedSoftBreaks(source, text), ...emphasisSpans(root, source)].toSorted((left, right) => left.start - right.start);

/** root is the Markdown tree, or undefined for a plain-text document, where nothing is code and URLs are bare. */
export const factTextOf = (source: string, root: MarkdownNode | undefined): FactText => {
  const code = root === undefined ? [] : opaqueSpans(root);
  const codeless = maskSpans(source, code);
  const parts = root === undefined ? { chrome: [], linkSpans: [], listMarkers: [] } : markdownParts(root, source);
  const insideLinks = spanIndex(parts.linkSpans);
  // An autolink's text is its URL: it is read once, as the link.
  const bare = bareUrls(codeless).filter((url) => !overlapsAny(insideLinks, url));
  const blanked = [...code, ...parts.chrome, ...bare];
  const text = maskSpans(source, blanked);
  return { text, codeless, blanked: spanIndex(blanked), bareUrls: bare, listMarkers: parts.listMarkers, unseen: unseenOf(source, text, root) };
};
