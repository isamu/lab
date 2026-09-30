import type { Lexicon, Span } from "./plugin.ts";
import { linesOf, type Line } from "./structure/lines.ts";

/**
 * The parts of a plain-text or Markdown email that are not the writer's prose: the header, the separator lines between
 * messages, the signature, and a quoted reply. Found by shape, in any genre; the field names and the attribution words
 * come from the language package's lexicons.
 */
export type EmailVocabulary = {
  /** Header field names, lower-cased. */
  readonly headerFields: ReadonlySet<string>;
  /** The fields whose value the writer types (Subject, To), lower-cased. Their value stays prose, on a line of its own. */
  readonly writtenFields: ReadonlySet<string>;
  /** Words an attribution line ends with, before its colon ("wrote", 「書きました」). */
  readonly attributions: readonly string[];
};

export type EmailParts = {
  /**
   * Header lines (all of them but a written field's value), separator lines, signatures and attribution lines: masked
   * from prose, and paragraphs are cut around them.
   */
  readonly furniture: readonly Span[];
  /** An attribution line and the quoted lines after it: someone else's words, so not this document's headings or structure. */
  readonly replyQuotes: readonly Span[];
};

const lowerCased = (lexicon: Lexicon | undefined): ReadonlySet<string> => new Set((lexicon ?? []).map((entry) => entry.pattern.toLowerCase()));

export const emailVocabulary = (lexicons: Readonly<Record<string, Lexicon>>): EmailVocabulary => ({
  headerFields: lowerCased(lexicons["email-header-field"]),
  writtenFields: lowerCased(lexicons["email-written-field"]),
  attributions: (lexicons["email-attribution"] ?? []).map((entry) => entry.pattern),
});

/** A signature has at most this many lines after its "-- " line (the convention is four). More is prose again. */
const SIGNATURE_MAX_LINES = 4;
/** An attribution paragraph longer than this is a paragraph of the writer's that happens to end with "wrote:". */
const ATTRIBUTION_MAX_LINES = 3;
/** Away from the top of a message, one known field ("Date: the first Monday") is a sentence; a header names several. */
const HEADER_MIN_FIELDS = 2;

/** "Field: value" or 「件名：値」. A colon followed by text, as in a URL, is not a field. */
const FIELD = /^([^\s:：]{1,40})(?::(?:[ \t]+|$)|：[ \t]*)/u;
const FOLDED = /^[ \t]+\S/u;
/** An mbox archive's envelope line (RFC 4155): "From ", the sender, then the date. It has no colon after From. */
const ENVELOPE = /^From [^\s:]+ /u;
const SIGNATURE = /^-- ?$/u;
/** A line of dashes, underscores or equals signs, with a few words between them or none: "-----Original Message-----". */
const SEPARATOR = /^[-_=]{3,}(?:([^-_=]{1,40})[-_=]{2,})?$/u;
/** Two rules with only spaces or strokes between them are a drawing (an RFC's diagram), not a separator. */
const LETTER = /\p{L}/u;
const QUOTED = /^ {0,3}>/u;
const QUOTED_TEXT = /^ {0,3}>[\s>]*\S/u;
/** Gmail's attribution ends with the sender's address and a colon: 「… 山田太郎 <taro@example.com>:」. An archive writes "taro at example.com". */
const BRACKETED_THEN_COLON = /<([^<>]*)>[ \t]*[:：]$/u;
const ADDRESS_MARK = /@| at /u;
const LATIN_LETTER = /[A-Za-z]/u;

const isBlank = (line: Line | undefined): boolean => line !== undefined && line.text.trim() === "";
const isSeparator = (line: Line | undefined): boolean => {
  const match = line === undefined ? null : SEPARATOR.exec(line.text.trim());
  return match !== null && (match[1] === undefined || LETTER.test(match[1]));
};
const isQuoted = (line: Line | undefined): boolean => line !== undefined && QUOTED.test(line.text);
const endOf = (line: Line): number => line.start + line.text.length;
const spanOfLines = (first: Line, last: Line): Span => ({ start: first.start, end: endOf(last) });

/** The first index at or after `from` whose line meets `test`, or -1. Scans forward only, so a long document stays linear. */
const indexFrom = (lines: readonly Line[], from: number, test: (line: Line, index: number) => boolean): number => {
  for (let index = Math.max(0, from); index < lines.length; index += 1) {
    const line = lines[index];
    if (line !== undefined && test(line, index)) return index;
  }
  return -1;
};

/** The last index at or before `from` whose line meets `test`, or -1. */
const indexBackFrom = (lines: readonly Line[], from: number, test: (line: Line) => boolean): number => {
  for (let index = Math.min(from, lines.length - 1); index >= 0; index -= 1) {
    const line = lines[index];
    if (line !== undefined && test(line)) return index;
  }
  return -1;
};

/** Runs of lines between blank lines and separator lines. */
const blocksOf = (lines: readonly Line[]): Line[][] =>
  lines.reduce<Line[][]>((blocks, line, index) => {
    if (isBlank(line) || isSeparator(line) || SIGNATURE.test(line.text)) return blocks;
    const previous = lines[index - 1];
    if (previous !== undefined && !isBlank(previous) && !isSeparator(previous) && !SIGNATURE.test(previous.text)) blocks.at(-1)?.push(line);
    else blocks.push([line]);
    return blocks;
  }, []);

/** The block opens a message: nothing but blank lines before it, or before it and the nearest separator line. */
const opensMessage = (lines: readonly Line[], first: Line): boolean => {
  const last = indexBackFrom(lines, first.number - 2, (line) => !isBlank(line));
  return last === -1 || isSeparator(lines[last]);
};

const knownField = (text: string, vocabulary: EmailVocabulary): boolean => {
  const name = FIELD.exec(text)?.[1];
  return name !== undefined && vocabulary.headerFields.has(name.toLowerCase());
};

const isHeaderLine = (line: Line, index: number): boolean =>
  FIELD.test(line.text) || (index > 0 && FOLDED.test(line.text)) || (index === 0 && ENVELOPE.test(line.text));

const isHeader = (block: readonly Line[], atTop: boolean, vocabulary: EmailVocabulary): boolean => {
  if (!block.every(isHeaderLine)) return false;
  const known = block.filter((line) => knownField(line.text, vocabulary)).length;
  if (known >= HEADER_MIN_FIELDS) return true;
  // Fewer known fields make a header only at the top of a message, and only if no other field sits beside them: "Summary:" is the writer's.
  return atTop && known > 0 && block.every((line) => !FIELD.test(line.text) || knownField(line.text, vocabulary));
};

/** A header's fields: each line with the folded lines under it. */
const fieldsOf = (block: readonly Line[]): Line[][] =>
  block.reduce<Line[][]>((fields, line, index) => {
    if (index > 0 && FOLDED.test(line.text)) fields.at(-1)?.push(line);
    else fields.push([line]);
    return fields;
  }, []);

/** A written field loses only its label and keeps its value; any other field, and the envelope line, go whole. */
const fieldMask = (field: readonly Line[], vocabulary: EmailVocabulary): Span | undefined => {
  const first = field[0];
  const last = field.at(-1);
  if (first === undefined || last === undefined) return undefined;
  const label = FIELD.exec(first.text);
  const name = label?.[1]?.toLowerCase();
  if (label === null || name === undefined || !vocabulary.writtenFields.has(name)) return spanOfLines(first, last);
  return { start: first.start, end: first.start + label[0].length };
};

const headerSpans = (lines: readonly Line[], vocabulary: EmailVocabulary): Span[] =>
  blocksOf(lines).flatMap((block) => {
    const first = block[0];
    if (first === undefined || !isHeader(block, opensMessage(lines, first), vocabulary)) return [];
    return fieldsOf(block).flatMap((field) => fieldMask(field, vocabulary) ?? []);
  });

/** From the "-- " line: the blank lines right after it, then its lines up to a blank line, a separator or a quote. */
const signatureAt = (lines: readonly Line[], delimiter: Line): Span => {
  const firstText = indexFrom(lines, delimiter.number, (line) => !isBlank(line));
  if (firstText === -1) return spanOfLines(delimiter, delimiter);
  const stop = indexFrom(
    lines,
    firstText,
    (line, index) => index - firstText >= SIGNATURE_MAX_LINES || isBlank(line) || isSeparator(line) || isQuoted(line) || SIGNATURE.test(line.text),
  );
  return spanOfLines(delimiter, lines[(stop === -1 ? lines.length : stop) - 1] ?? delimiter);
};

const signatureSpans = (lines: readonly Line[]): Span[] => lines.filter((line) => SIGNATURE.test(line.text)).map((line) => signatureAt(lines, line));

const endsWithAttribution = (text: string, vocabulary: EmailVocabulary): boolean => {
  const trimmed = text.trimEnd();
  if (ADDRESS_MARK.test(BRACKETED_THEN_COLON.exec(trimmed)?.[1] ?? "")) return true;
  if (!/[:：]$/u.test(trimmed)) return false;
  const words = trimmed.slice(0, -1).trimEnd();
  return vocabulary.attributions.some((word) => {
    if (!words.endsWith(word)) return false;
    const before = words.at(-word.length - 1) ?? "";
    return !(LATIN_LETTER.test(word.charAt(0)) && LATIN_LETTER.test(before));
  });
};

/** The paragraph that ends right before `index`, skipping blank lines: its lines, if it is short enough to be an attribution. */
const attributionBefore = (lines: readonly Line[], index: number, vocabulary: EmailVocabulary): Line[] | undefined => {
  const lastText = indexBackFrom(lines, index - 1, (line) => !isBlank(line));
  if (lastText === -1) return undefined;
  const floor = lastText - ATTRIBUTION_MAX_LINES;
  const window = lines.slice(Math.max(0, floor), lastText + 1);
  const opening = window.findLastIndex((line) => isBlank(line) || isSeparator(line) || isQuoted(line));
  if (opening === -1 && floor > 0) return undefined;
  const paragraph = window.slice(opening + 1);
  if (paragraph.length === 0 || paragraph.length > ATTRIBUTION_MAX_LINES) return undefined;
  return endsWithAttribution(paragraph.map((line) => line.text.trim()).join(" "), vocabulary) ? paragraph : undefined;
};

/** A quoted line, or a line with text run on from a quoted line with text (a lazy continuation, as Markdown reads it). */
const continuesQuote = (lines: readonly Line[], index: number): boolean => {
  const line = lines[index];
  if (isQuoted(line)) return true;
  const previous = lines[index - 1];
  return line !== undefined && !isBlank(line) && !isSeparator(line) && previous !== undefined && QUOTED_TEXT.test(previous.text);
};

/** The last line of the quote that starts at `index`. Blank lines between quoted lines stay inside it. */
const quoteEnd = (lines: readonly Line[], index: number): number => {
  const chunk = { start: index };
  for (;;) {
    const next = indexFrom(lines, chunk.start + 1, (_, at) => !continuesQuote(lines, at));
    if (next === -1) return lines.length - 1;
    const resumes = indexFrom(lines, next, (line) => !isBlank(line));
    if (resumes === -1 || !isQuoted(lines[resumes])) return next - 1;
    chunk.start = resumes;
  }
};

const quoteStarts = (lines: readonly Line[]): number[] => lines.flatMap((line, index) => (isQuoted(line) && !continuesQuote(lines, index - 1) ? [index] : []));

type Reply = { readonly attribution: Span; readonly quote: Span };

const repliesOf = (lines: readonly Line[], vocabulary: EmailVocabulary): Reply[] =>
  quoteStarts(lines).reduce<Reply[]>((replies, start) => {
    const covered = replies.at(-1);
    const line = lines[start];
    if (line === undefined || (covered !== undefined && line.start < covered.quote.end)) return replies;
    const attribution = attributionBefore(lines, start, vocabulary);
    const first = attribution?.[0];
    const last = attribution?.at(-1);
    if (first === undefined || last === undefined) return replies;
    const end = lines[quoteEnd(lines, start)];
    if (end === undefined) return replies;
    return [...replies, { attribution: spanOfLines(first, last), quote: spanOfLines(first, end) }];
  }, []);

const bySpanStart = (left: Span, right: Span): number => left.start - right.start;

export const emailParts = (source: string, vocabulary: EmailVocabulary): EmailParts => {
  const lines = linesOf(source);
  const replies = repliesOf(lines, vocabulary);
  const separators = lines.filter((line) => isSeparator(line)).map((line) => spanOfLines(line, line));
  return {
    furniture: [...headerSpans(lines, vocabulary), ...separators, ...signatureSpans(lines), ...replies.map((reply) => reply.attribution)].toSorted(bySpanStart),
    replyQuotes: replies.map((reply) => reply.quote),
  };
};
