import type { BulletList, Detector, Finding, MarkupHeading, Paragraph, ProseDocument, Span } from "../plugin.ts";
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

/** A number that opens an item's title: `(5)`, `１ `, `2.`. A numbered title is a heading whatever its wording. */
const ITEM_NUMBER = /^(?:[(（][0-9０-９]+[)）]|[0-9０-９]+[.．]?\s)/u;

/** A Japanese reading comma: an unnumbered bold line that joins clauses is a statement set in bold, not a section's name. */
const CLAUSE_COMMA = /、/u;

const isEmphasisedStatement = (text: string): boolean => CLAUSE_COMMA.test(text) && !ITEM_NUMBER.test(text);

const OPENING_BRACKET = /[(（]/u;
const CLOSING_BRACKET = /[)）]/u;

const bracketDepthChange = (char: string): number => {
  if (OPENING_BRACKET.test(char)) return 1;
  return CLOSING_BRACKET.test(char) ? -1 : 0;
};

/** Whether one bracket pair wraps the whole text, `(Example of a README)`: a caption over what follows, not a section. */
export const isBracketedCaption = (text: string): boolean => {
  const chars = [...text];
  if (chars.length < 2 || !OPENING_BRACKET.test(chars[0] ?? "")) return false;
  const depths = chars.reduce<number[]>((acc, char) => [...acc, (acc.at(-1) ?? 0) + bracketDepthChange(char)], []);
  return depths.at(-1) === 0 && depths.slice(0, -1).every((depth) => depth > 0);
};

/** The bold run's words, or undefined when the paragraph is not one bold line. */
const boldLineText = (paragraph: string): string | undefined => BOLD_PARAGRAPH.exec(paragraph.trim())?.[2]?.trim();

/** The bold line's words, or undefined when the paragraph is not one bold line that could name a section. */
export const pseudoHeadingText = (paragraph: string): string | undefined => {
  const text = boldLineText(paragraph);
  if (text === undefined || text.length > MAX_HEADING_CHARS) return undefined;
  if (WHOLE_LINK.test(text) || WHOLE_CODE.test(text) || CLOSING_PUNCTUATION.test(text) || FIELD_COLON.test(text)) return undefined;
  if (isBracketedCaption(text) || isEmphasisedStatement(text)) return undefined;
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

/** The lines above `offset` in its block, the run of lines no blank line breaks. */
const linesAbove = (source: string, offset: number): string[] => {
  const above = source.slice(0, offset).split("\n").slice(0, -1);
  const blank = above.findLastIndex((line) => line.trim() === "");
  return above.slice(blank + 1);
};

/** Whether a bracketed caption opens the block: the bold lines under it are titles inside the example it shows. */
const underCaption = (source: string, offset: number): boolean =>
  linesAbove(source, offset).some((line) => {
    const text = boldLineText(line);
    return text !== undefined && isBracketedCaption(text);
  });

const LIST_ITEM_MARKER = /^\s*(?:[-*+]|\d{1,9}[.)])\s+/u;

/** Where the next block after `end` starts, or -1 at the end of the document. */
const nextBlockStart = (source: string, end: number): number => {
  const next = source.slice(end).search(/\S/u);
  return next === -1 ? -1 : end + next;
};

const isLinkItem = (source: string, item: Span): boolean => WHOLE_LINK.test(source.slice(item.start, item.end).replace(LIST_ITEM_MARKER, "").trim());

/** The list starting at `start` when every item is a link alone: a list of references. */
const linkListAt = (doc: ProseDocument, start: number): BulletList | undefined => {
  const list = doc.lists.find((candidate) => candidate.span.start === start);
  return list?.itemSpans.every((item) => isLinkItem(doc.source, item)) === true ? list : undefined;
};

/** Whether plain text, not a heading or another bold line, starts at `start`. */
const plainTextAt = (doc: ProseDocument, start: number, headings: readonly MarkupHeading[]): boolean => {
  const paragraph = doc.paragraphs.find((candidate) => candidate.span.start === start);
  if (paragraph === undefined || headings.some((heading) => heading.start === start)) return false;
  return boldLineText(doc.source.slice(paragraph.span.start, paragraph.span.end)) === undefined;
};

/** Whether the bold line labels a list of links and the section's text resumes under it: no section for a heading to open. */
const labelsLinksMidSection = (doc: ProseDocument, paragraph: Paragraph, headings: readonly MarkupHeading[]): boolean => {
  const list = linkListAt(doc, nextBlockStart(doc.source, paragraph.span.end));
  return list !== undefined && plainTextAt(doc, nextBlockStart(doc.source, list.span.end), headings);
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
    if (text === undefined || !headsBody(doc, paragraph, headings) || underCaption(doc.source, paragraph.span.start)) return [];
    if (labelsLinksMidSection(doc, paragraph, headings)) return [];
    return [findingAt(doc, paragraph.span, { heading: text })];
  });
};
