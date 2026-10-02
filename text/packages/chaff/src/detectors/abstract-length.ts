// An abstract longer than the limit, or a paper with sections and no abstract. Pure. What labels an abstract (要旨,
// Abstract) and what names a paper's section (はじめに, Methods) come from the language's abstract-heading and
// paper-section-heading lexicons. An abstract in the other language (the English Abstract of a Japanese paper) is
// measured in that language's unit and against its limit.
import { lengthOf } from "../measure.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, DetectorOptions, Finding, LengthUnit, ProseDocument, Sentence, Span } from "../plugin.ts";

/** A paper with this many section headings (Introduction, Methods, …) is expected to have an abstract. */
const MIN_SECTIONS = 2;

/** The marks around a label: a heading's number, 【】, a colon or a full stop after it, emphasis. */
const LABEL_MARKS = new Set(" \t\n\u3000.．#*_【[（():：】])）0123456789");
/** Where a label at a paragraph's head ends: "Abstract: We …", "【要旨】本研究は…", "Abstract.We …". */
const LABEL_ENDS = ["】", ":", "：", ".", "．"];
/** A label at a paragraph's head is a word or two: past this many characters the colon belongs to a sentence. */
const MAX_LABEL = 24;

export const labelOf = (text: string): string => {
  const chars = [...text];
  const first = chars.findIndex((char) => !LABEL_MARKS.has(char));
  const last = chars.findLastIndex((char) => !LABEL_MARKS.has(char));
  return first === -1
    ? ""
    : chars
        .slice(first, last + 1)
        .join("")
        .toLowerCase();
};

/** The label at a paragraph's head and how long it is with the spaces after it, or undefined. */
export const headLabel = (text: string): { readonly label: string; readonly length: number } | undefined => {
  const head = text.slice(0, MAX_LABEL);
  const end = LABEL_ENDS.map((mark) => head.indexOf(mark))
    .filter((index) => index > 0)
    .toSorted((left, right) => left - right)[0];
  if (end === undefined) return undefined;
  const rest = text.slice(end + 1);
  return { label: labelOf(head.slice(0, end + 1)), length: end + 1 + rest.length - rest.trimStart().length };
};

export type AbstractSpan = { readonly label: number; readonly body: Span };

type Words = { readonly abstracts: ReadonlySet<string>; readonly sections: ReadonlySet<string> };

const wordsOf = (doc: ProseDocument): Words => {
  const set = (id: string): ReadonlySet<string> => new Set((doc.lexicons[id] ?? []).map((entry) => entry.pattern.toLowerCase()));
  return { abstracts: set("abstract-heading"), sections: set("paper-section-heading") };
};

/** Abstracts under a heading of their own: the text up to the next heading. */
const underHeadings = (doc: ProseDocument, words: Words): AbstractSpan[] => {
  const headings = doc.markup?.headings ?? [];
  return headings.flatMap((heading, index): AbstractSpan[] =>
    words.abstracts.has(labelOf(heading.text))
      ? [{ label: heading.start, body: { start: heading.end, end: headings[index + 1]?.start ?? doc.source.length } }]
      : [],
  );
};

/** Abstracts labelled in a paragraph: the label alone on its line (the next paragraph is the abstract) or at its head. */
const inParagraphs = (doc: ProseDocument, words: Words): AbstractSpan[] =>
  doc.paragraphs.flatMap((paragraph, index): AbstractSpan[] => {
    const text = doc.source.slice(paragraph.span.start, paragraph.span.end);
    const next = doc.paragraphs[index + 1];
    if (words.abstracts.has(labelOf(text))) return next === undefined ? [] : [{ label: paragraph.span.start, body: next.span }];
    const head = headLabel(text);
    if (head === undefined || !words.abstracts.has(head.label)) return [];
    return [{ label: paragraph.span.start, body: { start: paragraph.span.start + head.length, end: paragraph.span.end } }];
  });

export const abstractsOf = (doc: ProseDocument): AbstractSpan[] => {
  const words = wordsOf(doc);
  const found = [...underHeadings(doc, words), ...inParagraphs(doc, words)].toSorted((left, right) => left.label - right.label);
  return found.filter((abstract, index) => found.findIndex((other) => other.label === abstract.label) === index);
};

/** The first heading that names a paper's section, when there are MIN_SECTIONS of them; undefined otherwise. */
export const firstSectionHeading = (doc: ProseDocument): number | undefined => {
  const words = wordsOf(doc);
  const sections = (doc.markup?.headings ?? []).filter((heading) => words.sections.has(labelOf(heading.text)));
  return sections.length >= MIN_SECTIONS ? sections[0]?.start : undefined;
};

type Measure = { readonly size: number; readonly limit: number | undefined; readonly unit: LengthUnit };

/** The part of a sentence inside the span: a label at the head of the abstract's paragraph is not counted. */
const clipped = (sentence: Sentence, body: Span): Sentence => {
  const from = Math.max(0, body.start - sentence.span.start);
  return from === 0 ? sentence : { ...sentence, text: sentence.text.slice(from), span: { start: sentence.span.start + from, end: sentence.span.end } };
};

/** The abstract's length, in the unit of the language most of its sentences are in, and that language's limit. */
export const measureAbstract = (doc: ProseDocument, body: Span, options: DetectorOptions): Measure => {
  const sentences = doc.sentences
    .filter((sentence) => sentence.span.end > body.start && sentence.span.start < body.end)
    .map((sentence) => clipped(sentence, body));
  const embedded = sentences.filter((sentence) => sentence.embeddedLanguage !== undefined);
  const other = embedded.length * 2 > sentences.length ? embedded[0]?.embeddedLanguage : undefined;
  const unit = other?.lengthUnit ?? doc.lengthUnit;
  const limit = other === undefined ? options.limit : options.embeddedLimits?.[other.id];
  return { size: sentences.reduce((sum, sentence) => sum + lengthOf(sentence, unit), 0), limit, unit };
};

const finding = (doc: ProseDocument, offset: number, variant: string, values: Readonly<Record<string, number>>): Finding => ({
  rule: "abstract-length",
  severity: "info",
  line: 0,
  column: 0,
  quote: quoteAt(doc.source, offset),
  values: { ...values, offset },
  variant,
});

export const abstractLength: Detector = (doc, options): Finding[] => {
  const abstracts = abstractsOf(doc);
  if (abstracts.length === 0) {
    const section = firstSectionHeading(doc);
    return section === undefined ? [] : [finding(doc, section, "missing", {})];
  }
  return abstracts.flatMap((found) => {
    const measure = measureAbstract(doc, found.body, options);
    if (measure.limit === undefined || measure.size <= measure.limit) return [];
    return [finding(doc, found.label, measure.unit === "word" ? "words" : "chars", { count: measure.size, limit: measure.limit })];
  });
};
