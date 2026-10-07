// The pieces of an HTML page the converters look at: tags, links, attributes and elements matched to their own
// closing tag. Pure; a regular-expression reading, not a parser.
import { decodeEntities } from "./markup-text.ts";

// In a tag a quote opens a value only after "=", and the value ends only at its matching quote, whatever it holds.
const TAG_BODY = String.raw`(?:[^>=]|=\s*"[^"]*"|=\s*'[^']*'|=(?!\s*["']))*`;

// A comment, a processing instruction, a script and a style are matched whole, so that no tag is read inside them
// (the converter drops them anyway), and a "<!--" inside a value is escaped before comments are looked for.
const TAG = new RegExp(String.raw`<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(script|style)\b${TAG_BODY}>[\s\S]*?<\/\1\s*>|<[a-z][a-z0-9-]*${TAG_BODY}>`, "giu");

const QUOTED_VALUE = /=(\s*)("[^"]*"|'[^']*')/gu;

const withValuesEscaped = (tag: string): string =>
  tag.replace(QUOTED_VALUE, (_whole: string, space: string, value: string) => `=${space}${value.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}`);

/**
 * Each "<" and ">" inside a quoted attribute value (title="published under the <span>…</span>") as a character
 * reference, which means the same in a value, so that a scanner reading a tag up to its first ">" reads all of it.
 */
export const withAttributeMarkupEscaped = (html: string): string => html.replace(TAG, (tag: string) => withValuesEscaped(tag));

/** Apply step until the text stops changing: nested elements are removed from the inside out. */
export const untilStable = (text: string, step: (text: string) => string): string => {
  const next = step(text);
  return next === text ? text : untilStable(next, step);
};

export const stripTags = (html: string): string => html.replace(/<\/?[a-z!][^>]*>/giu, "");

export const plainText = (html: string): string => decodeEntities(stripTags(html)).replace(/\s+/gu, " ").trim();

/** Text put back into markup, so that decoding it again gives the same text. */
export const asMarkup = (text: string): string => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");

/** A full stop, question or exclamation mark closing a sentence, also before a closing quote or bracket; not the point in "3.5". */
export const CLOSED_SENTENCE = /[。．！？]|[.!?][)\]"'”’]*(?=\s|$)/u;

/** Whether the markup closes a sentence, each tag read as a space so that "Done.</li><li>Next" ends one. */
export const hasSentence = (html: string): boolean => CLOSED_SENTENCE.test(plainText(html.replace(/<\/?[a-z!][^>]*>/giu, " ")));

export const hasNoWords = (text: string): boolean => !/[\p{L}\p{N}]/u.test(text);

export const ANY_LINK = /<a\b[^>]*>[\s\S]*?<\/a\s*>/giu;

const HREF = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/iu;

const PAGE_EXTENSION = /^(?:[sx]?html?|php|aspx?|jsp|cgi)$/iu;

// The host is not part of the path: "https://example.com" names a site, not a file ending in .com.
const SCHEME_AND_HOST = /^(?:[a-z][a-z0-9+.-]*:)?\/\/[^/?#]*/iu;

// A link that opens no page (tel:, mailto:, sms:) carries its own content, a number or an address.
const OTHER_SCHEME = /^\s*(?!https?:)[a-z][a-z0-9+.-]*:(?!\/\/)/iu;

const hrefOf = (link: string): string => {
  const href = HREF.exec(link);
  return href?.[1] ?? href?.[2] ?? href?.[3] ?? "";
};

/** The extension of the file a link opens ("pdf", "mp3"), or undefined for a page or a site. */
export const fileExtension = (link: string): string | undefined => {
  const path = hrefOf(link).replace(SCHEME_AND_HOST, "").split(/[?#]/u)[0] ?? "";
  const extension = /\.([a-z0-9]{1,5})$/iu.exec(path.split("/").at(-1) ?? "")?.[1];
  return extension !== undefined && !PAGE_EXTENSION.test(extension) ? extension : undefined;
};

/** A link to a file (an appendix as PDF, a table as .xlsx), or one that opens no page, is part of the document. */
export const isFileLink = (link: string): boolean => OTHER_SCHEME.test(hrefOf(link)) || fileExtension(link) !== undefined;

/** Attributes before a given one, each skipped whole so that a quoted value (title="x role=main") is not read as one. */
export const ATTRIBUTES = String.raw`(?:\s+[^\s"'>=/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*?`;

export type ElementRange = { readonly start: number; readonly end: number; readonly openTag: string; readonly inner: string };

type RangeScan = { readonly open: readonly RegExpExecArray[]; readonly ranges: readonly ElementRange[] };

const closeLast = (html: string, scan: RangeScan, close: RegExpExecArray): RangeScan => {
  const opener = scan.open.at(-1);
  if (opener === undefined) return scan;
  const range = {
    start: opener.index,
    end: close.index + close[0].length,
    openTag: opener[0],
    inner: html.slice(opener.index + opener[0].length, close.index),
  };
  return { open: scan.open.slice(0, -1), ranges: [...scan.ranges, range] };
};

/** Every <tag>…</tag>, nested ones matched to their own closing tag, in document order (outer before inner). */
export const elementRanges = (html: string, tag: string): ElementRange[] =>
  [...html.matchAll(new RegExp(`<(/?)${tag}\\b[^>]*>`, "giu"))]
    .reduce<RangeScan>((scan, match) => (match[1] === "/" ? closeLast(html, scan, match) : { open: [...scan.open, match], ranges: scan.ranges }), {
      open: [],
      ranges: [],
    })
    .ranges.toSorted((left, right) => left.start - right.start);

export const isInside = (outer: ElementRange, inner: ElementRange): boolean => outer.start < inner.start && inner.end <= outer.end;

/** The ranges (in document order) each replaced by a space; one inside another cut one goes with it. */
export const withoutRanges = (html: string, ranges: readonly ElementRange[]): string => {
  const chosen = ranges.reduce<ElementRange[]>((kept, range) => {
    const insideKept = (kept.at(-1)?.end ?? 0) > range.start;
    if (!insideKept) kept.push(range);
    return kept;
  }, []);
  const cut = chosen.reduce<{ readonly parts: readonly string[]; readonly from: number }>(
    (acc, range) => ({ parts: [...acc.parts, html.slice(acc.from, range.start), " "], from: range.end }),
    { parts: [], from: 0 },
  );
  return [...cut.parts, html.slice(cut.from)].join("");
};

/** The <tag> elements that are chrome, each replaced by a space; one inside another dropped one goes with it. */
export const withoutElementsWhere = (html: string, tag: string, isChrome: (range: ElementRange) => boolean): string =>
  withoutRanges(html, elementRanges(html, tag).filter(isChrome));

/** Every <tag> whose opening matches, for each tag that opens that way, replaced by a space. */
export const withoutElementsOpening = (html: string, opening: RegExp, isChrome: (range: ElementRange) => boolean): string => {
  const tags = new Set([...html.matchAll(opening)].map((match) => (match[1] ?? "").toLowerCase()));
  return [...tags].reduce((text, tag) => withoutElementsWhere(text, tag, isChrome), html);
};

export const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"];

export const headingRanges = (html: string): ElementRange[] => HEADING_TAGS.flatMap((tag) => elementRanges(html, tag));
