// The pieces of an HTML page the converters look at: tags, links, attributes and elements matched to their own
// closing tag. Pure; a regular-expression reading, not a parser.
import { decodeEntities } from "./markup-text.ts";

export const stripTags = (html: string): string => html.replace(/<\/?[a-z!][^>]*>/giu, "");

export const plainText = (html: string): string => decodeEntities(stripTags(html)).replace(/\s+/gu, " ").trim();

export const hasNoWords = (text: string): boolean => !/[\p{L}\p{N}]/u.test(text);

export const ANY_LINK = /<a\b[^>]*>[\s\S]*?<\/a\s*>/giu;

/** Attributes before a given one, each skipped whole so that a quoted value (title="x role=main") is not read as one. */
export const ATTRIBUTES = String.raw`(?:\s+[^\s"'>=/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*?`;

export type ElementRange = { readonly start: number; readonly end: number; readonly openTag: string; readonly inner: string };

type RangeScan = { readonly open: readonly RegExpExecArray[]; readonly ranges: readonly ElementRange[] };

const closeLast = (html: string, scan: RangeScan, close: RegExpExecArray): RangeScan => {
  const opener = scan.open.at(-1);
  if (opener === undefined) return scan;
  const range = {
    start: opener.index,
    end: close.index + close[0].length,
    openTag: opener[0],
    inner: html.slice(opener.index + opener[0].length, close.index),
  };
  return { open: scan.open.slice(0, -1), ranges: [...scan.ranges, range] };
};

/** Every <tag>…</tag>, nested ones matched to their own closing tag, in document order (outer before inner). */
export const elementRanges = (html: string, tag: string): ElementRange[] =>
  [...html.matchAll(new RegExp(`<(/?)${tag}\\b[^>]*>`, "giu"))]
    .reduce<RangeScan>((scan, match) => (match[1] === "/" ? closeLast(html, scan, match) : { open: [...scan.open, match], ranges: scan.ranges }), {
      open: [],
      ranges: [],
    })
    .ranges.toSorted((left, right) => left.start - right.start);

export const isInside = (outer: ElementRange, inner: ElementRange): boolean => outer.start < inner.start && inner.end <= outer.end;
