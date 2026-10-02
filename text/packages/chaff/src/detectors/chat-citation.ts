import type { Detector, Finding, Lexicon, Span } from "../plugin.ts";
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

/** What the reader meets: the visible text and the links' destinations. Code is not read. A document that is not Markdown is all text. */
const readableSpans = (doc: Parameters<Detector>[0]): Span[] => {
  const markup = markupOf(doc);
  return markup === undefined ? [{ start: 0, end: doc.source.length }] : [...markup.texts, ...markup.links];
};

/** Each marker is a leftover in its own right, so each is reported, from the first. */
export const chatCitationResidue: Detector = (doc, options): Finding[] => {
  const readable = readableSpans(doc);
  const markers = markersIn(doc.source, options.lexicon ?? []).filter((marker) => within(readable, marker.span));
  if (markers.length === 0 || markers.length < options.limit) return [];
  return markers.map((marker) => findingAt(doc, marker.span, { matched: marker.matched, count: markers.length, limit: options.limit }));
};
