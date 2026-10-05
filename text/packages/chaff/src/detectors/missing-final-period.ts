import type { Detector, Finding, LexiconEntry, Paragraph, ProseDocument, Token } from "../plugin.ts";
import { formMinority } from "./form-minority.ts";

// A paragraph whose last sentence stops without its closing mark, in a document whose other paragraphs end with one. It
// takes no side: a document that ends none of its paragraphs with the mark (slides, labels) is not reported. The marks
// come from the language's lexicon "final-period": group "end" is the period, group "other-end" closes a sentence another
// way (？, ！) so the paragraph is not counted, and group "note" opens a note line. The
// lexicon is read directly rather than as the rule's word list, since its marks are what a fixed paragraph ends with.

/** A paragraph's end, and whether it closes with a sentence-ending mark. form is "closed" or "open". */
export type ParagraphEnd = { readonly offset: number; readonly form: string; readonly text: string };

/** The marks the detector reads, from the lexicon. */
export type PeriodMarks = { readonly ends: readonly string[]; readonly otherEnds: readonly string[]; readonly notes: readonly string[] };

/** Brackets and quotes that may follow a closing mark (〜です。」). */
const CLOSERS = '」』）)"”’';
/** A line that is itself a quotation closes like a sentence. */
const QUOTE_CLOSERS = "」』";
/** A paragraph ending in a colon leads into a list or a block; it is not a sentence left open. */
const LEAD_IN = /[：:]$/u;
/** Two spaces in a row, half- or full-width, lay a line out like a table (an ingredient, then its amount), so it is not a sentence. */
const LAYOUT = /[ \u3000]{2}/u;
/** Fewer characters than this is a label or a caption, not a sentence. */
const MIN_SENTENCE_CHARS = 15;
/** Words that end a clause: a verb, an adjective or an auxiliary in its dictionary form ends the sentence. */
const PREDICATE: ReadonlySet<string> = new Set(["VERB", "ADJ", "AUX"]);

/** The line's last mark before any closing brackets and quotes is one of these. */
const endsWithMark = (line: string, marks: readonly string[]): boolean => {
  const chars = Array.from(line);
  return marks.includes(chars[chars.findLastIndex((char) => !CLOSERS.includes(char))] ?? "");
};

const isClosed = (line: string, ends: readonly string[]): boolean => endsWithMark(line, ends) || QUOTE_CLOSERS.includes(line.at(-1) ?? "\0");

/** A note, a laid-out row, or a question or exclamation: not a sentence that could take the period. */
const isAside = (line: string, marks: PeriodMarks): boolean =>
  marks.notes.some((note) => line.startsWith(note)) || LAYOUT.test(line) || endsWithMark(line, marks.otherEnds);

/** The paragraph's last word ends a sentence: a predicate written in its dictionary form (〜します, 〜である, 望ましい). */
const endsInPredicate = (paragraph: Paragraph): boolean => {
  const last = (paragraph.sentences.at(-1)?.tokens ?? []).filter((token: Token) => token.surface.trim() !== "").at(-1);
  return last !== undefined && PREDICATE.has(last.pos) && last.lemma === last.surface;
};

/** How a paragraph ends, or undefined when its last line is not a sentence (a label, a lead-in, a note, a laid-out row). */
export const paragraphEnd = (text: string, paragraph: Paragraph, marks: PeriodMarks): ParagraphEnd | undefined => {
  const body = text.slice(paragraph.span.start, paragraph.span.end).trimEnd();
  const last = body.split("\n").at(-1)?.trim() ?? "";
  if (Array.from(last).length < MIN_SENTENCE_CHARS || LEAD_IN.test(last)) return undefined;
  const offset = paragraph.span.start + body.length - 1;
  if (isAside(last, marks)) return undefined;
  if (isClosed(last, marks.ends)) return { offset, form: "closed", text: last };
  // A closing parenthetical after the sentence (〜します（別紙を参照する）) is not where the period goes.
  return !CLOSERS.includes(last.at(-1) ?? "\0") && endsInPredicate(paragraph) ? { offset, form: "open", text: last } : undefined;
};

const marksOf = (lexicon: readonly LexiconEntry[]): PeriodMarks => ({
  ends: lexicon.filter((entry) => entry.group === "end").map((entry) => entry.pattern),
  otherEnds: lexicon.filter((entry) => entry.group === "other-end").map((entry) => entry.pattern),
  notes: lexicon.filter((entry) => entry.group === "note").map((entry) => entry.pattern),
});

export const missingFinalPeriod: Detector = (doc: ProseDocument, options): Finding[] => {
  const text = doc.prose ?? doc.source;
  const marks = marksOf(doc.lexicons["final-period"] ?? []);
  const ends = doc.paragraphs.flatMap((paragraph) => paragraphEnd(text, paragraph, marks) ?? []);
  const minority = formMinority(ends, options.limit);
  if (minority === undefined || minority.usual.form !== "closed") return [];
  return minority.odd.map((end) => ({
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: end.text,
    values: { count: minority.odd.length, of: ends.length, offset: end.offset },
  }));
};
