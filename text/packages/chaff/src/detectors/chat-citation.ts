import type { Detector, Finding, Lexicon, ProseDocument, Span } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { findingAt, markupOf } from "./markup-finding.ts";

/** One marker a chat interface leaves when its answer is pasted: where it is and what was written. */
export type ChatMarker = { readonly matched: string; readonly span: Span };

/** Every place a lexicon pattern is written in `text`, case and all, in the order they appear. */
export const markersIn = (text: string, lexicon: Lexicon): ChatMarker[] =>
  lexicon
    .filter((entry) => entry.pattern !== "")
    .flatMap((entry) =>
      [...text.matchAll(new RegExp(escapeRegExp(entry.pattern), "gu"))].map((match) => ({
        matched: entry.pattern,
        span: { start: match.index, end: match.index + entry.pattern.length },
      })),
    )
    .toSorted((left, right) => left.span.start - right.span.start);

const within = (outer: readonly Span[], span: Span): boolean => outer.some((range) => range.start <= span.start && span.end <= range.end);

/** Whether any of the span is left as prose: code, HTML and quotes are blanked out of `prose`, so a marker there shows nothing. */
export const showsInProse = (prose: string, span: Span): boolean => prose.slice(span.start, span.end).trim() !== "";

/**
 * The destination part of a link or an image as written: after `](` for `[text](url)`, after `]:` for a definition, and
 * the whole of an autolink. The label is left out, so code in a link's text stays code.
 */
export const destinationOf = (source: string, span: Span): Span => {
  const written = source.slice(span.start, span.end);
  const inline = written.lastIndexOf("](");
  if (inline !== -1) return { start: span.start + inline + "](".length, end: span.end };
  const defined = written.indexOf("]:");
  return defined === -1 ? span : { start: span.start + defined + "]:".length, end: span.end };
};

/** Where a marker reaches the reader: the prose (a marker may straddle Markdown's nodes), the visible text (a bare URL), or a link's or an image's destination. */
const reachesReader = (doc: ProseDocument, span: Span): boolean => {
  const markup = markupOf(doc);
  if (markup === undefined || doc.prose === undefined) return true;
  const destinations = [...markup.links, ...markup.images].map((target) => destinationOf(doc.source, target));
  return showsInProse(doc.prose, span) || within([...markup.texts, ...destinations], span);
};

/** Quotation marks, parentheses and sentence punctuation at the ends of a word, which are not part of it. */
const SURROUNDING = new Set(['"', "'", "“", "”", "‘", "’", "(", ")", ".", ",", ";", ":", "!", "?"]);
const SPACE = /\s/u;

/** What is left of a string after the surrounding marks at both of its ends. */
const withoutSurrounding = (text: string): string => {
  const chars = [...text];
  const first = chars.findIndex((char) => !SURROUNDING.has(char));
  return first === -1 ? "" : chars.slice(first, chars.findLastIndex((char) => !SURROUNDING.has(char)) + 1).join("");
};

/**
 * Whether the marker stands as a word of its own (links ending in "?utm_source=chatgpt.com", marks such as oaicite.):
 * prose about the marks names them. What a chat answer leaves is always joined to a URL or a citation (oaicite:0).
 */
export const standsAlone = (source: string, span: Span): boolean => {
  const lineStart = source.lastIndexOf("\n", span.start - 1) + 1;
  const lineEnd = source.indexOf("\n", span.end);
  const before = source.slice(lineStart, span.start).split(SPACE).at(-1) ?? "";
  const after = source.slice(span.end, lineEnd === -1 ? source.length : lineEnd).split(SPACE)[0] ?? "";
  const marker = source.slice(span.start, span.end);
  return withoutSurrounding(`${before}${marker}${after}`) === marker;
};

/** Each marker is a leftover in its own right, so each is reported, from the first. */
export const chatCitationResidue: Detector = (doc, options): Finding[] => {
  const markers = markersIn(doc.source, options.lexicon ?? []).filter((marker) => reachesReader(doc, marker.span) && !standsAlone(doc.source, marker.span));
  if (markers.length === 0 || markers.length < options.limit) return [];
  return markers.map((marker) => findingAt(doc, marker.span, { matched: marker.matched, count: markers.length, limit: options.limit }));
};
