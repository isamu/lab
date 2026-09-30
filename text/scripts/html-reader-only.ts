// Text a page writes for a screen reader alone, which a sighted reader never sees: an element whose class follows a
// visually-hidden convention, and the anchor a skip link moves focus to. Pure; a regular-expression reading.
import {
  ATTRIBUTES,
  HEADING_TAGS,
  headingRanges,
  isInside,
  plainText,
  withoutElementsOpening,
  withoutElementsWhere,
  type ElementRange,
} from "./html-elements.ts";

// The class names that frameworks and style guides give text written for a screen reader alone (sr-only,
// visually-hidden, govuk-visually-hidden, screen-reader-text), never negated (not-sr-only shows it); "hidden" only as
// a whole name (not hidden-xs).
const READER_ONLY_CLASS = /^(?:(?!not-)[a-z0-9]+-)*(?:sr-only|visually-?hidden|screen-reader-text|element-invisible)$/iu;

const CLASS_OPENING = /<([a-z][a-z0-9-]*)\b[^>]*\sclass\s*=/giu;

const CLASS_VALUE = new RegExp(String.raw`^<[a-z][a-z0-9-]*${ATTRIBUTES}\s+class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))`, "iu");

/** A variant (md:block, md:not-sr-only) shows the element on some screens or states, so it is not hidden from sight. */
const isReaderOnlyClass = (range: ElementRange): boolean => {
  const value = CLASS_VALUE.exec(range.openTag);
  const names = (value?.[1] ?? value?.[2] ?? value?.[3] ?? "").split(/\s+/u);
  if (names.some((name) => name.includes(":"))) return false;
  return names.some((name) => READER_ONLY_CLASS.test(name)) || names.includes("hidden");
};

/** An anchor with no href that only a script can focus: where a skip link moves the reader ("ここから本文です。"). */
const isFocusTarget = (range: ElementRange): boolean =>
  !/\shref\s*=/iu.test(range.openTag) && /\stabindex\s*=\s*(?:"\s*-1\s*"|'\s*-1\s*'|-1(?=[\s/>]))/iu.test(range.openTag);

const LINE_TAGS = [
  "p",
  "div",
  "li",
  "dt",
  "dd",
  "td",
  "th",
  ...HEADING_TAGS,
  "section",
  "article",
  "header",
  "footer",
  "main",
  "body",
  "blockquote",
  "ul",
  "ol",
  "dl",
  "table",
  "tr",
];

const LINE_BOUNDARY = new RegExp(String.raw`<\/?(?:${LINE_TAGS.join("|")})\b[^<>]*>|<br\b[^<>]*>`, "giu");

/** Text between the anchor and the block's edge on each side: what shares a line with it. */
const lineAround = (html: string, range: ElementRange): readonly [string, string] => {
  const before = html.slice(0, range.start);
  const lineStart = [...before.matchAll(LINE_BOUNDARY)].at(-1);
  const after = html.slice(range.end);
  const lineEnd = new RegExp(LINE_BOUNDARY.source, "iu").exec(after)?.index ?? after.length;
  return [lineStart === undefined ? before : before.slice(lineStart.index + lineStart[0].length), after.slice(0, lineEnd)];
};

/** No other text on its line: the anchor is a block of its own, not a word in a sentence. */
const standsAlone = (html: string, range: ElementRange): boolean => lineAround(html, range).every((beside) => plainText(beside) === "");

/**
 * Text the page writes for a screen reader and does not show. A focus target counts only standing alone outside a
 * heading: inside a heading it is the heading's title, inside a sentence a word of it.
 */
export const withoutReaderOnlyText = (html: string): string => {
  const headings = headingRanges(html);
  const isReaderTarget = (anchor: ElementRange): boolean =>
    isFocusTarget(anchor) && standsAlone(html, anchor) && !headings.some((heading) => isInside(heading, anchor));
  const targets = withoutElementsWhere(html, "a", isReaderTarget);
  return withoutElementsOpening(targets, CLASS_OPENING, isReaderOnlyClass);
};
