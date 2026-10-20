// Quotations in single quotation marks ('…' and ‘…’), as court opinions quote a statute or an earlier case. The mark is
// also an apostrophe (don't, the courts' power, 'tis), so it opens only at a word's start before a letter, closes only at a
// word's end, and a quotation counts only when it closes within its paragraph. Pure.
import type { Span } from "./plugin.ts";

/** An opening mark: at the start, or after a space, an opening bracket or a dash, and before a letter. */
const OPENER = /(?<=^|[\s([{—–-])['‘](?=\p{L})/gu;
/** A closing mark: after a letter, a digit or a stop, and not before a letter or a digit (。 and 」 close too). */
const CLOSER = /(?<=[\p{L}\p{N}.,;:!?)\]。、])['’](?![\p{L}\p{N}])/gu;
/** A blank line ends a paragraph. A mark still open there was an apostrophe ('tis, 'em), not a quotation. */
const PARAGRAPH_BREAK = /\n[ \t]*\n/gu;

type Mark = { readonly at: number; readonly kind: "open" | "close" | "break" };

const marksIn = (text: string): Mark[] =>
  [
    ...[...text.matchAll(OPENER)].map((match): Mark => ({ at: match.index, kind: "open" })),
    ...[...text.matchAll(CLOSER)].map((match): Mark => ({ at: match.index, kind: "close" })),
    ...[...text.matchAll(PARAGRAPH_BREAK)].map((match): Mark => ({ at: match.index, kind: "break" })),
  ].toSorted((left, right) => left.at - right.at);

/** Changed in place within one reading: copying the spans at each mark is quadratic in a long opinion. */
type Scan = { open: number | undefined; readonly spans: Span[] };

const step = (scan: Scan, mark: Mark): Scan => {
  if (scan.open === undefined) {
    if (mark.kind === "open") scan.open = mark.at;
    return scan;
  }
  if (mark.kind === "close") scan.spans.push({ start: scan.open + 1, end: mark.at });
  if (mark.kind !== "open") scan.open = undefined;
  return scan;
};

/**
 * The insides of the single-quoted quotations in text, the marks left out. A closing mark with no quotation open (the
 * courts' power) closes nothing, an opening mark inside an open quotation opens nothing, and a mark that does not close
 * within its paragraph quotes nothing.
 */
export const singleQuotedSpans = (text: string): Span[] => marksIn(text).reduce<Scan>(step, { open: undefined, spans: [] }).spans;
