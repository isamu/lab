import type { Span } from "../plugin.ts";

/** One marker a chat interface leaves when its answer is pasted: where it is and what was written. */
export type ChatMarker = { readonly matched: string; readonly span: Span };

const CLOSING_OF: Readonly<Record<string, string>> = { "[": "]", "【": "】" };
const OPENING_OF: Readonly<Record<string, string>> = { "]": "[", "】": "【" };
const LEAD_IN = ":";

const lineEndAfter = (source: string, index: number): number => {
  const end = source.indexOf("\n", index);
  return end === -1 ? source.length : end;
};

/** Where the bracket opened at `open` closes on its line (just after the closer), or undefined when it does not. */
const closedAt = (source: string, open: number): number | undefined => {
  const closer = CLOSING_OF[source[open] ?? ""];
  if (closer === undefined) return undefined;
  const close = source.indexOf(closer, open + 1);
  return close === -1 || close >= lineEndAfter(source, open) ? undefined : close + 1;
};

/** A marker that opens a bracket (contentReference[) runs to its closer and any {…} right after it. */
const forwardEnd = (source: string, span: Span): number => {
  const opened = span.end - 1;
  const closed = CLOSING_OF[source[opened] ?? ""] === undefined ? undefined : closedAt(source, opened);
  const end = closed ?? span.end;
  return source[end] === "{" ? (closedBraceAt(source, end) ?? end) : end;
};

const closedBraceAt = (source: string, open: number): number | undefined => {
  const close = source.indexOf("}", open + 1);
  return close === -1 || close >= lineEndAfter(source, open) ? undefined : close + 1;
};

/** A marker that closes a bracket it did not open (†source】) starts where that bracket opens on its line. */
const backwardStart = (source: string, span: Span): number => {
  const written = source.slice(span.start, span.end);
  const opener = OPENING_OF[written.at(-1) ?? ""];
  if (opener === undefined || written.includes(opener)) return span.start;
  const lineStart = source.lastIndexOf("\n", span.start - 1) + 1;
  const open = source.lastIndexOf(opener, span.start - 1);
  return open < lineStart ? span.start : open;
};

/** The whole mark a marker belongs to as written (:contentReference[oaicite:0]{index=0}, 【4:0†source】). */
export const markExtent = (source: string, span: Span): Span => {
  const start = backwardStart(source, span);
  const end = forwardEnd(source, span);
  const widened = end > span.end || start < span.start;
  return { start: widened && source[start - 1] === LEAD_IN ? start - 1 : start, end };
};

/** One marker per mark: each widened to its whole mark, and the markers inside a mark already taken dropped. */
export const wholeMarks = (source: string, markers: readonly ChatMarker[]): ChatMarker[] =>
  markers
    .map((marker) => markExtent(source, marker.span))
    .toSorted((left, right) => left.start - right.start || right.end - left.end)
    .reduce<Span[]>((kept, span) => {
      const last = kept.at(-1);
      return last !== undefined && span.start < last.end ? kept : [...kept, span];
    }, [])
    .map((span) => ({ matched: source.slice(span.start, span.end), span }));
