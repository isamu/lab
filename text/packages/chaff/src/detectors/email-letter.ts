// A work email or letter's own parts: a greeting and a closing, a subject line, and an attachment the text mentions.
// Pure. The words (お世話になっております, Dear, Best regards, 件名, attached) come from the language's email-greeting,
// email-closing, email-subject-field, attachment-mention, attachment-not-mention and attachment-line lexicons. The
// header and the signature are masked in doc.prose; a quoted reply is someone else's words and is left out.
import { escapeRegExp } from "../orthography.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding, ProseDocument, Span } from "../plugin.ts";

/** A greeting comes before the body: past the subject, the addressee (株式会社… / 総務部 山田様) and the writer's name. */
const GREETING_LINES = 5;
/** A closing comes at the end, before the writer's name, title, company, address and contact lines, or an acceptance block. */
const CLOSING_LINES = 10;

/** One line of the writer's own text. breaks: a heading, the header or the signature stood between it and the line before. */
export type BodyLine = { readonly start: number; readonly text: string; readonly breaks: boolean };

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

const LATIN_START = /^[A-Za-z]/u;
const LETTER = /\p{L}/u;

/**
 * Whether a line holds one of the words. A Latin word opens the line (Dear, Best regards) and is followed by no letter,
 * so "Hi" does not match "History"; a Japanese word may stand anywhere in it (いつもお世話になっております).
 */
export const lineHas = (line: string, words: readonly string[]): boolean => {
  const trimmed = line.trim();
  const folded = trimmed.toLowerCase();
  return words.some((word) => {
    if (!LATIN_START.test(word)) return trimmed.includes(word);
    return folded.startsWith(word.toLowerCase()) && !LETTER.test(trimmed.charAt(word.length));
  });
};

/**
 * Whether each offset, asked in rising order, is inside one of the spans (sorted by start). One pass over the spans for
 * the whole document: an archive with a quoted reply in every message stays linear.
 */
const insideCursor = (spans: readonly Span[]): ((offset: number) => boolean) => {
  const sorted = spans.toSorted((left, right) => left.start - right.start);
  const cursor = { next: 0, farthestEnd: -1 };
  return (offset) => {
    while (cursor.next < sorted.length && (sorted[cursor.next]?.start ?? Infinity) <= offset) {
      cursor.farthestEnd = Math.max(cursor.farthestEnd, sorted[cursor.next]?.end ?? 0);
      cursor.next += 1;
    }
    return offset < cursor.farthestEnd;
  };
};

/**
 * A line prose masks words at the head of: a header field whose value stays (Subject: …), not the writer's text. Emphasis
 * marks are masked too, but they hold no letter.
 */
const isFieldLine = (sourceLine: string, proseLine: string): boolean => {
  const sourceChars = [...sourceLine];
  const kept = [...proseLine].findIndex((char, index) => char.trim() !== "" || sourceChars[index]?.trim() === "");
  return LETTER.test(sourceChars.slice(0, kept === -1 ? sourceChars.length : kept).join(""));
};

type SourceLine = { readonly start: number; readonly text: string };

const linesWithOffsets = (text: string): SourceLine[] => {
  const lines: SourceLine[] = [];
  text.split("\n").forEach((line) => lines.push({ start: (lines.at(-1)?.start ?? 0) + (lines.at(-1)?.text.length ?? -1) + 1, text: line }));
  return lines;
};

/**
 * The writer's own lines, in order: not blank once the header and signature are masked (prose), not a quoted reply, not a
 * heading. A heading, or a line the source has and prose masks (a header, a signature), breaks the text into parts.
 */
export const bodyLines = (source: string, prose: string, replyQuotes: readonly Span[]): BodyLine[] => {
  const quoted = insideCursor(replyQuotes);
  const lines: BodyLine[] = [];
  const state = { broken: false };
  linesWithOffsets(prose).forEach(({ start, text }) => {
    const trimmed = text.trimStart();
    const sourceLine = source.slice(start, start + text.length);
    const masked = trimmed === "" ? sourceLine.trim() !== "" : isFieldLine(sourceLine, text);
    const inQuote = quoted(start);
    if (masked || trimmed.startsWith("#")) state.broken = true;
    else if (trimmed !== "" && !trimmed.startsWith(">") && !inQuote) {
      lines.push({ start, text, breaks: state.broken });
      state.broken = false;
    }
  });
  return lines;
};

/** The lines split where a heading, a header or a signature breaks them: a letter and its appendix, or one message and the next. */
const partsOf = (lines: readonly BodyLine[]): BodyLine[][] => {
  const parts: BodyLine[][] = [];
  lines.forEach((line) => {
    const current = parts.at(-1);
    if (line.breaks || current === undefined) parts.push([line]);
    else current.push(line);
  });
  return parts;
};

export type FrameSlip = { readonly variant: "greeting" | "closing"; readonly offset: number };

/** A missing greeting (none in the first lines) and a missing closing (none in the last lines of any part). */
export const frameSlips = (lines: readonly BodyLine[], greetings: readonly string[], closings: readonly string[]): FrameSlip[] => {
  const first = lines[0];
  const last = lines.at(-1);
  if (first === undefined || last === undefined) return [];
  const greeted = lines.slice(0, GREETING_LINES).some((line) => lineHas(line.text, greetings));
  const closed = partsOf(lines).some((part) => part.slice(-CLOSING_LINES).some((line) => lineHas(line.text, closings)));
  return [
    ...(greeted ? [] : [{ variant: "greeting" as const, offset: first.start }]),
    ...(closed ? [] : [{ variant: "closing" as const, offset: last.start }]),
  ];
};

export const emailFrame: Detector = (doc): Finding[] =>
  frameSlips(bodyLines(doc.source, doc.prose ?? doc.source, doc.replyQuotes ?? []), patternsOf(doc, "email-greeting"), patternsOf(doc, "email-closing")).map(
    (slip) => ({
      rule: "email-greeting-closing",
      severity: "info",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, slip.offset),
      values: { offset: slip.offset },
      variant: slip.variant,
    }),
  );

export type SubjectLine = { readonly start: number; readonly subject: string };

/** A field's name is one word of at most this many characters. */
const MAX_FIELD_NAME = 20;
const BLANK = /\s/u;

/** "Subject: Lunch" as its name and value; undefined for a line that is no field. */
export const fieldOf = (line: string): { readonly name: string; readonly value: string } | undefined => {
  const colon = [...line].findIndex((char) => char === ":" || char === "：");
  if (colon <= 0) return undefined;
  const chars = [...line];
  const name = chars.slice(0, colon).join("").trimEnd();
  return name.length > MAX_FIELD_NAME || BLANK.test(name)
    ? undefined
    : {
        name,
        value: chars
          .slice(colon + 1)
          .join("")
          .trim(),
      };
};

/** The subject lines (Subject: …, 件名：…), outside a quoted reply, with reply and forward marks (Re:, Fwd:) taken off the value. */
export const subjectLines = (source: string, fields: readonly string[], replyMarks: readonly string[], replyQuotes: readonly Span[]): SubjectLine[] => {
  const names = new Set(fields.map((field) => field.toLowerCase()));
  const quoted = insideCursor(replyQuotes);
  return linesWithOffsets(source).flatMap(({ start, text }): SubjectLine[] => {
    const field = fieldOf(text);
    const inQuote = quoted(start);
    return field === undefined || inQuote || !names.has(field.name.toLowerCase()) ? [] : [{ start, subject: withoutReplyMarks(field.value, replyMarks) }];
  });
};

/** "Re: Fwd: Lunch" is "Lunch": the marks a mail program adds are not what the writer wrote. Read piece by piece between colons. */
export const withoutReplyMarks = (subject: string, marks: readonly string[]): string => {
  const folded = new Set(marks.map((mark) => mark.toLowerCase()));
  const pieces = subject.split(/[:：]/u);
  const kept = pieces.findIndex((piece, index) => index === pieces.length - 1 || !folded.has(piece.trim().toLowerCase()));
  const dropped = pieces.slice(0, kept).reduce((length, piece) => length + piece.length + 1, 0);
  return subject.slice(dropped).trim();
};

export const emailSubject: Detector = (doc, options): Finding[] =>
  subjectLines(doc.source, patternsOf(doc, "email-subject-field"), patternsOf(doc, "email-reply-mark"), doc.replyQuotes ?? []).flatMap((line): Finding[] => {
    const length = [...line.subject].length;
    if (length > 0 && length <= options.limit) return [];
    return [
      {
        rule: "email-subject-length",
        severity: "warning",
        line: 0,
        column: 0,
        quote: quoteAt(doc.source, line.start),
        values: { count: length, limit: options.limit, offset: line.start },
        ...(length === 0 ? { variant: "empty" } : {}),
      },
    ];
  });

/** Where the text first mentions an attachment (添付します, attached), outside the phrases that only look like one (attached to). */
export const firstMention = (lines: readonly BodyLine[], mentions: readonly string[], notMentions: readonly string[]): number | undefined => {
  const folded = (text: string): string => text.toLowerCase();
  const isMention = (text: string): boolean => {
    const cleared = notMentions.reduce((rest, phrase) => rest.split(folded(phrase)).join(" "), folded(text));
    return mentions.some((word) => cleared.includes(folded(word)));
  };
  const line = lines.find((candidate) => isMention(candidate.text));
  return line === undefined ? undefined : line.start + line.text.length - line.text.trimStart().length;
};

/** The marks around a label line: a heading's #, emphasis, 【】. */
const LINE_MARKS = new Set("#*_【】 \t\u3000");

const withoutMarks = (line: string): string => {
  const chars = [...line];
  const first = chars.findIndex((char) => !LINE_MARKS.has(char));
  return first === -1 ? "" : chars.slice(first, chars.findLastIndex((char) => !LINE_MARKS.has(char)) + 1).join("");
};

/** A line that labels what is attached: the label and a colon (Attachment: quote.pdf), or the label alone (### Enclosures, 【添付資料】). */
const labelsAttachment = (line: string, labels: readonly string[]): boolean => {
  const bare = withoutMarks(line).toLowerCase();
  return labels.some((label) => {
    const folded = label.toLowerCase();
    return bare === folded || (bare.startsWith(folded) && /^\s*[:：]/u.test(bare.slice(folded.length)));
  });
};

/** An attachment shown: a line that labels it, a file name with a listed extension, or the archive's note. text is the writer's own (no quoted reply). */
export const showsAttachment = (text: string, labels: readonly string[], extensions: readonly string[], notes: readonly string[]): boolean => {
  const labelled = text.split("\n").some((line) => labelsAttachment(line, labels));
  const fileName = new RegExp(`[\\w\\-ぁ-んァ-ヶ一-龠]\\.(?:${extensions.map(escapeRegExp).join("|")})\\b`, "iu");
  return labelled || (extensions.length > 0 && fileName.test(text)) || notes.some((note) => text.includes(note));
};

/** The source without someone else's words: a quoted reply's spans blanked and its "> " lines dropped. An old message's attachment is not this one's. */
export const ownText = (source: string, replyQuotes: readonly Span[]): string => {
  const pieces: string[] = [];
  const cursor = { at: 0 };
  replyQuotes
    .toSorted((left, right) => left.start - right.start)
    .forEach((span) => {
      const from = Math.max(span.start, cursor.at);
      pieces.push(source.slice(cursor.at, from), " ".repeat(Math.max(0, span.end - from)));
      cursor.at = Math.max(cursor.at, span.end);
    });
  pieces.push(source.slice(cursor.at));
  return pieces
    .join("")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");
};

export const attachmentMissing: Detector = (doc): Finding[] => {
  const lines = bodyLines(doc.source, doc.prose ?? doc.source, doc.replyQuotes ?? []);
  const mention = firstMention(lines, patternsOf(doc, "attachment-mention"), patternsOf(doc, "attachment-not-mention"));
  if (mention === undefined) return [];
  const extensions = patternsOf(doc, "attachment-file-extension").map((extension) => extension.replace(/^\./u, ""));
  if (showsAttachment(ownText(doc.source, doc.replyQuotes ?? []), patternsOf(doc, "attachment-line"), extensions, patternsOf(doc, "email-attachment-note")))
    return [];
  return [
    {
      rule: "attachment-not-attached",
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, mention),
      values: { offset: mention },
    },
  ];
};
