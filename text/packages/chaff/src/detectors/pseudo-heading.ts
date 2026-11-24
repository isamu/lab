import type { Detector, Finding, MarkupHeading, Paragraph, ProseDocument } from "../plugin.ts";
import { isQuotedAt } from "./bold-label.ts";
import { findingAt, writtenHeadings } from "./markup-finding.ts";

// A paragraph that is one bold line, standing where a heading would (markdownlint MD036). Pure: reads the source and headings.

/** A paragraph that is only a bold run: `**Next steps**`, `__次の手順__`. The run holds no delimiter of its own. */
const BOLD_PARAGRAPH = /^(\*\*|__)(?!\s)((?:(?!\1)[^\n])+?)(?<!\s)\1$/u;

/** A link around the whole text: inline, reference, collapsed or shortcut. A bold link alone is a button, not a heading. */
const WHOLE_LINK = /^\[[^\]\n]+\](?:\([^)\s]*\)|\[[^\]\n]*\])?$/u;

/** Inline code around the whole text names a value, not a section. */
const WHOLE_CODE = /^`[^`]+`$/u;

/** Punctuation that ends a sentence, a clause or a lead-in, as markdownlint counts it: a heading does not end in it. */
const CLOSING_PUNCTUATION = /[.,;:!?。，；：！？、]$/u;

/** A colon inside the text makes it a field and its value (Rating: 4 out of 5), not a heading. */
const FIELD_COLON = /[:：]/u;

/** Longer than this, a bold line is a sentence set in bold for emphasis, not the name of a section. */
const MAX_HEADING_CHARS = 80;

/** The bold line's words, or undefined when the paragraph is not one bold line that could name a section. */
export const pseudoHeadingText = (paragraph: string): string | undefined => {
  const text = BOLD_PARAGRAPH.exec(paragraph.trim())?.[2]?.trim();
  if (text === undefined || text.length > MAX_HEADING_CHARS) return undefined;
  if (WHOLE_LINK.test(text) || WHOLE_CODE.test(text) || CLOSING_PUNCTUATION.test(text) || FIELD_COLON.test(text)) return undefined;
  return text;
};

/** The headings that build an outline: all of them but an opening title, the one level-1 heading a document starts with. */
const sectionHeadings = (headings: readonly MarkupHeading[]): readonly MarkupHeading[] => (headings[0]?.depth === 1 ? headings.slice(1) : headings);

/** Whether body text follows the paragraph before the next heading: a bold line over nothing, or over a heading, heads no section. */
const headsBody = (doc: ProseDocument, paragraph: Paragraph, headings: readonly MarkupHeading[]): boolean => {
  const next = doc.source.slice(paragraph.span.end).search(/\S/u);
  if (next === -1) return false;
  const nextStart = paragraph.span.end + next;
  return !headings.some((heading) => heading.start === nextStart);
};

/**
 * A bold line standing alone, after the document has begun its outline with real headings: the writer marks sections with
 * headings, and this one was set in bold instead, so a table of contents and a screen reader do not see it.
 */
export const pseudoHeading: Detector = (doc): Finding[] => {
  const headings = writtenHeadings(doc);
  const outline = sectionHeadings(headings);
  const firstSection = outline[0];
  if (firstSection === undefined) return [];
  return doc.paragraphs.flatMap((paragraph) => {
    if (paragraph.span.start < firstSection.start || isQuotedAt(doc.source, paragraph.span.start)) return [];
    const text = pseudoHeadingText(doc.source.slice(paragraph.span.start, paragraph.span.end));
    if (text === undefined || !headsBody(doc, paragraph, headings)) return [];
    return [findingAt(doc, paragraph.span, { heading: text })];
  });
};
