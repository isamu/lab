import type { Detector, Finding, LexiconEntry, Paragraph, ProseDocument, Token } from "../plugin.ts";
import { formMinority } from "./form-minority.ts";
import { captionParagraphs, slotParagraphs } from "./final-period-captions.ts";

// A paragraph whose last sentence stops without its closing mark, in a document whose other paragraphs end with one. It
// takes no side: a document that ends none of its paragraphs with the mark (slides, labels) is not reported. The marks
// come from the language's lexicon "final-period": group "end" is the period, group "other-end" closes a sentence another
// way (？, ！) so the paragraph is not counted, group "note" opens a note line, and group "label" opens a run-in heading. The
// lexicon is read directly rather than as the rule's word list, since its marks are what a fixed paragraph ends with.

/** A paragraph's end, and whether it closes with a sentence-ending mark. form is "closed" or "open". */
export type ParagraphEnd = { readonly offset: number; readonly form: string; readonly text: string };

/** The marks the detector reads, from the lexicon. */
export type PeriodMarks = {
  readonly ends: readonly string[];
  readonly otherEnds: readonly string[];
  readonly notes: readonly string[];
  readonly labels: readonly string[];
};

/** Brackets and quotes that may follow a closing mark (〜です。」). */
const CLOSERS = '」』）)"”’';
/** A line that is itself a quotation closes like a sentence. */
const QUOTE_CLOSERS = "」』";
/** A paragraph ending in a colon leads into a list or a block; it is not a sentence left open. */
const LEAD_IN = /[：:]$/u;
/** A paragraph opened by a colon, under a term, is the description in a definition list (a term, then ": what it does"). */
const DESCRIPTION = /^[：:](?![：:])/u;
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

const opensWithLabel = (body: string, marks: PeriodMarks): boolean => marks.labels.some((label) => body.trimStart().startsWith(label));

/**
 * A paragraph of one line opened by a heading mark (●1人で作業しない), not closed, with a paragraph of prose after it: it
 * heads that text. A run of such lines one after another is a list of sentences, and is counted.
 */
const isRunInHeading = (body: string, after: string | undefined, marks: PeriodMarks): boolean =>
  !body.includes("\n") &&
  opensWithLabel(body, marks) &&
  !isClosed(body.trim(), marks.ends) &&
  after !== undefined &&
  after.trim() !== "" &&
  !opensWithLabel(after, marks);

/** The paragraph's last word ends a sentence: a predicate written in its dictionary form (〜します, 〜である, 望ましい). */
const endsInPredicate = (paragraph: Paragraph): boolean => {
  const last = (paragraph.sentences.at(-1)?.tokens ?? []).filter((token: Token) => token.surface.trim() !== "").at(-1);
  return last !== undefined && PREDICATE.has(last.pos) && last.lemma === last.surface;
};

const bodyOf = (text: string, paragraph: Paragraph): string => text.slice(paragraph.span.start, paragraph.span.end).trim();

/** A term of a definition list: one short line with no closing mark, or a description of the same term before it. */
const isTerm = (body: string, marks: PeriodMarks): boolean =>
  DESCRIPTION.test(body) || (!body.includes("\n") && Array.from(body).length < MIN_SENTENCE_CHARS && !isClosed(body, marks.ends));

/**
 * A description in a definition list, written like a table cell rather than a sentence: a paragraph opened by a colon
 * right under a term (プレビュー / :入力した内容をプレビューできます).
 */
const isDescription = (text: string, paragraph: Paragraph, marks: PeriodMarks, previous: Paragraph | undefined): boolean =>
  DESCRIPTION.test(bodyOf(text, paragraph)) && previous !== undefined && isTerm(bodyOf(text, previous), marks);

/** The last line written under a short caption line in the same paragraph (乾式バッテリー / 約7割の車いすに使われている): a name and its note, as in a table cell. */
const isUnderCaption = (body: string, marks: PeriodMarks): boolean => {
  const caption = body.split("\n").at(-2)?.trim();
  return caption !== undefined && Array.from(caption).length < MIN_SENTENCE_CHARS && !isClosed(caption, marks.ends);
};

/** How a paragraph ends, or undefined when its last line is not a sentence (a label, a lead-in, a note, a laid-out row). */
export const paragraphEnd = (text: string, paragraph: Paragraph, marks: PeriodMarks, next?: Paragraph, previous?: Paragraph): ParagraphEnd | undefined => {
  if (isDescription(text, paragraph, marks, previous)) return undefined;
  const body = text.slice(paragraph.span.start, paragraph.span.end).trimEnd();
  const last = body.split("\n").at(-1)?.trim() ?? "";
  if (Array.from(last).length < MIN_SENTENCE_CHARS || LEAD_IN.test(last)) return undefined;
  const offset = paragraph.span.start + body.length - 1;
  const after = next === undefined ? undefined : text.slice(next.span.start, next.span.end);
  if (isAside(last, marks) || isRunInHeading(body, after, marks) || isUnderCaption(body, marks)) return undefined;
  if (isClosed(last, marks.ends)) return { offset, form: "closed", text: last };
  // A closing parenthetical after the sentence (〜します（別紙を参照する）) is not where the period goes.
  return !CLOSERS.includes(last.at(-1) ?? "\0") && endsInPredicate(paragraph) ? { offset, form: "open", text: last } : undefined;
};

const marksOf = (lexicon: readonly LexiconEntry[]): PeriodMarks => ({
  ends: lexicon.filter((entry) => entry.group === "end").map((entry) => entry.pattern),
  otherEnds: lexicon.filter((entry) => entry.group === "other-end").map((entry) => entry.pattern),
  notes: lexicon.filter((entry) => entry.group === "note").map((entry) => entry.pattern),
  labels: lexicon.filter((entry) => entry.group === "label").map((entry) => entry.pattern),
});

export const missingFinalPeriod: Detector = (doc: ProseDocument, options): Finding[] => {
  const text = doc.prose ?? doc.source;
  const marks = marksOf(doc.lexicons["final-period"] ?? []);
  const captions = captionParagraphs(
    text,
    doc.sections,
    slotParagraphs(text, doc.paragraphs, (line) => isClosed(line, marks.ends)),
  );
  const ends = doc.paragraphs.flatMap((paragraph, index) =>
    captions.has(index) ? [] : (paragraphEnd(text, paragraph, marks, doc.paragraphs[index + 1], doc.paragraphs[index - 1]) ?? []),
  );
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
