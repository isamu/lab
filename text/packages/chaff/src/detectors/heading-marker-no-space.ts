import type { Detector, Finding, ProseDocument, Span } from "../plugin.ts";
import { isQuotedAt } from "./bold-label.ts";
import { findingAt, markupOf, writtenHeadings } from "./markup-finding.ts";

// A line meant as a heading whose marker has no space after it (`#見出し`, `##Heading`): Markdown shows it as a plain
// paragraph, marks and all (markdownlint MD018 and MD020). Pure: reads the source and the paragraphs.

/** Up to three spaces, one to six marks, then a letter straight after them. */
const UNSPACED_MARKER = /^ {0,3}(?<marks>#{1,6})(?<words>\p{L}.*)$/u;

/** The words without the closing marks of a closed heading (##Steps##), which are not part of them. */
const wordsOf = (written: string): string => {
  const characters = [...written.trimEnd()];
  return characters
    .slice(0, characters.findLastIndex((character) => character !== "#") + 1)
    .join("")
    .trimEnd();
};

/** A first word in lower-case ASCII after one mark is a tag, a directive or a colour (#chaff, #include, #fff), not a title. */
const LOWERCASE_WORD = /^[a-z][a-z0-9_-]*(?:\s|$)/u;

/** Another mark followed by a letter makes the line a row of tags (#chaff #lint). */
const ANOTHER_TAG = /#\p{L}/u;

type Marked = { readonly span: Span; readonly marks: string; readonly words: string; readonly alone: boolean };

const linesOf = (doc: ProseDocument, span: Span): Span[] => {
  const text = doc.source.slice(span.start, span.end);
  const starts = [0, ...[...text.matchAll(/\n/gu)].map((match) => match.index + 1)];
  return starts.map((start, at) => ({ start: span.start + start, end: span.start + (starts[at + 1] ?? text.length + 1) - 1 }));
};

const markedLines = (doc: ProseDocument): Marked[] =>
  doc.paragraphs.flatMap((paragraph) => {
    if (isQuotedAt(doc.source, paragraph.span.start)) return [];
    const lines = linesOf(doc, paragraph.span);
    return lines.flatMap((line) => {
      const groups = UNSPACED_MARKER.exec(doc.source.slice(line.start, line.end))?.groups;
      const marks = groups?.["marks"];
      const written = groups?.["words"];
      const words = written === undefined ? undefined : wordsOf(written);
      return marks === undefined || words === undefined ? [] : [{ span: line, marks, words, alone: lines.length === 1 }];
    });
  });

/**
 * One mark is also how a tag is written (#chaff), so a one-mark line counts only when it stands alone as its own
 * paragraph, its first word is not a tag-like lower-case word, it holds no other tag, and the document writes headings
 * elsewhere (a spaced heading, or a marked line with two or more marks).
 */
const isMeantAsHeading =
  (writesHeadings: boolean) =>
  (marked: Marked): boolean =>
    marked.marks.length > 1 || (writesHeadings && marked.alone && !LOWERCASE_WORD.test(marked.words) && !ANOTHER_TAG.test(marked.words));

export const headingMarkerNoSpace: Detector = (doc): Finding[] => {
  if (markupOf(doc) === undefined) return [];
  const marked = markedLines(doc);
  const writesHeadings = writtenHeadings(doc).length > 0 || marked.some((line) => line.marks.length > 1);
  return marked.filter(isMeantAsHeading(writesHeadings)).map((line) => findingAt(doc, line.span, { marker: line.marks, heading: line.words }));
};
