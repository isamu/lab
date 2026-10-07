// The shape of a document's top: whether the lead says anything the title does not, and whether a title or heading
// runs too long to scan. Pure; both read only the sections, paragraphs and tokens chaff has already built.
import { newContentMorphemes } from "./content-morphemes.ts";
import { trigrams } from "./heading-overlap.ts";
import { findingAt, writtenHeadings } from "./markup-finding.ts";
import type { Detector, Finding, LengthUnit, MarkupHeading, Paragraph, ProseDocument, Section } from "../plugin.ts";

/** A title shorter than this many character trigrams matches any lead by chance. */
const MIN_TITLE_GRAMS = 4;

/** The share of the title's trigrams the lead must repeat before its new words are counted: a lead on another subject is not an echo. */
const MIN_ECHO_PERCENT = 50;

const PERCENT = 100;

/** The document's title: its first top-level heading, when it has words. */
export const titleSectionOf = (doc: ProseDocument): Section | undefined => doc.sections.find((section) => section.depth === 1 && section.heading.trim() !== "");

/** The paragraph right under the title, with nothing but blank lines between them. A list, a table or an image first is not a lead. */
export const leadParagraphOf = (doc: ProseDocument, title: Section): Paragraph | undefined => {
  const first = doc.paragraphs.find((paragraph) => paragraph.span.start >= title.span.start && paragraph.span.start < title.span.end);
  if (first === undefined || first.sentences.length === 0) return undefined;
  return doc.source.slice(title.span.start, first.span.start).trim() === "" ? first : undefined;
};

/** How much of the title the lead repeats: the share of the title's character trigrams found in the lead, in percent. */
export const echoPercent = (title: string, lead: string): number => {
  const titleGrams = trigrams(title);
  if (titleGrams.size < MIN_TITLE_GRAMS) return 0;
  const leadGrams = trigrams(lead);
  return Math.round(([...titleGrams].filter((gram) => leadGrams.has(gram)).length / titleGrams.size) * PERCENT);
};

type Lead = { readonly title: Section; readonly lead: Paragraph; readonly fresh: number; readonly echo: number };

const leadOf = (doc: ProseDocument): Lead | undefined => {
  const title = titleSectionOf(doc);
  const lead = title === undefined ? undefined : leadParagraphOf(doc, title);
  if (title === undefined || lead === undefined || title.headingTokens === undefined) return undefined;
  const leadTokens = lead.sentences.flatMap((sentence) => sentence.tokens ?? []);
  const leadText = lead.sentences.map((sentence) => sentence.text).join(" ");
  return { title, lead, fresh: newContentMorphemes(title.headingTokens, leadTokens), echo: echoPercent(title.heading, leadText) };
};

/**
 * The lead restates the title: it repeats most of the title and adds fewer than `limit` content words of its own.
 * Both must hold: a lead that adds little but is about something else (a date, a byline) is not a restatement.
 */
export const noLead: Detector = (doc, options): Finding[] => {
  const found = leadOf(doc);
  if (found === undefined || found.echo < MIN_ECHO_PERCENT || found.fresh >= options.limit) return [];
  const first = found.lead.sentences[0];
  return [
    {
      rule: "no-lead",
      severity: "info",
      line: 0,
      column: 0,
      quote: first?.text.trim() ?? "",
      values: { title: found.title.heading, count: found.fresh, echo: found.echo, limit: options.limit, offset: first?.span.start ?? found.lead.span.start },
    },
  ];
};

/** A run of Latin letters and digits inside Japanese: a word, read at about the width of two characters. */
const LATIN_WORD = /[A-Za-z0-9][A-Za-z0-9._\-/@+#]*/gu;
const LATIN_WORD_CHARS = 2;

/** Inline Markdown left in a heading's text (`code`, **bold**, _emphasis_), which the reader does not see. */
const INLINE_MARKS = /[`*_]/gu;

/** A heading's length in the document's unit: words, or characters with each Latin word counted as two. */
export const headingLength = (heading: string, unit: LengthUnit): number => {
  const plain = heading.replace(INLINE_MARKS, "");
  if (unit === "word") return plain.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  const latinWords = [...plain.matchAll(LATIN_WORD)];
  const rest = plain.replace(LATIN_WORD, "").replace(/\s+/gu, "");
  return [...rest].length + latinWords.length * LATIN_WORD_CHARS;
};

/**
 * A heading that holds a sentence end followed by more text: a description pasted into the title line, not a name written
 * too long. A paragraph above a ---- rule is already left out by writtenHeadings.
 */
const SENTENCES_INSIDE = /[。．！？](?=\s*\S)|\p{Ll}{2}[.!?]["'”’)]?\s+["'“‘(]?\p{Lu}/u;

export const isParagraphHeading = (heading: string): boolean => SENTENCES_INSIDE.test(heading.trim());

/** A heading that asks a question: its length is the reader's question, not a name to shorten (FAQ, "Will this … increase …?"). */
const QUESTION_END = /[?？]["'”’)）」』]*$/u;

export const isQuestionHeading = (heading: string): boolean => QUESTION_END.test(heading.trim());

/** The heading's words without a number label at its head (Chapter 2, 1.), from the section the heading opens. */
const unlabeledOf = (doc: ProseDocument, heading: MarkupHeading): string =>
  doc.sections.find((section) => section.span.start === heading.end)?.unlabeledHeading ?? heading.text;

/** Each title or heading longer than the limit. The first top-level heading is the title; every other is a heading. */
export const titleLength: Detector = (doc, options): Finding[] => {
  const headings = writtenHeadings(doc);
  const title = headings.find((heading) => heading.depth === 1);
  return headings
    .map((heading) => ({ heading, words: unlabeledOf(doc, heading) }))
    .filter(({ words }) => !isParagraphHeading(words) && !isQuestionHeading(words))
    .map(({ heading, words }) => ({ heading, count: headingLength(words, doc.lengthUnit) }))
    .filter(({ count }) => count > options.limit)
    .map(({ heading, count }) => ({
      ...findingAt(doc, heading, { heading: heading.text.trim(), count, limit: options.limit }, heading === title ? "title" : undefined),
      rule: "title-length",
      severity: "info",
    }));
};
