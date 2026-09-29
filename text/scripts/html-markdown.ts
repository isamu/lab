// An HTML page (a CRS report as EveryCRSReport serves it, a ministry's page) as plain Markdown: headings, paragraphs,
// list items and the text of links; ruby keeps its base text and loses its reading. Only the <main> element (else the
// role="main" element, else a sole <article>) is read when the page has one. Scripts, styles, the head, navigation (by
// element or by role, and breadcrumbs), asides, footers, forms, tables, footnote marks, lists and blocks of nothing but
// links (a menu, a table of contents, previous/next links, a breadcrumb trail, also as a list ending in the page's
// title), a block before the page's title that holds a menu (the site's header, with its tagline and labels), lines of
// nothing but in-page or script links, and a copyright notice closing the page are dropped. Pure; a regular-expression reading that is enough for the documents in the corpus, not a parser
// for any HTML.
import { decodeEntities, tidyLines } from "./markup-text.ts";

const DROPPED = ["script", "style", "head", "nav", "aside", "footer", "form", "noscript", "svg", "table"];

/** Apply step until the text stops changing: nested elements are removed from the inside out. */
const untilStable = (text: string, step: (text: string) => string): string => {
  const next = step(text);
  return next === text ? text : untilStable(next, step);
};

const withoutElement = (html: string, tag: string): string => {
  const innermost = new RegExp(`<${tag}\\b[^>]*>(?:(?!<${tag}\\b)[\\s\\S])*?</${tag}\\s*>`, "giu");
  return untilStable(html, (text) => text.replace(innermost, " "));
};

const stripTags = (html: string): string => html.replace(/<\/?[a-z!][^>]*>/giu, "");

// HTML lets a ruby's parts omit their closing tags: a reading container (<rtc>) ends at the next <rb> or <rtc>, a
// reading (<rt>) or its bracket (<rp>) at the next <rb>, <rt> or <rp>; any of them at the end of the <ruby>.
const RUBY_TEXT_CONTAINER = /<rtc\b[^>]*>[\s\S]*?(?:<\/rtc\s*>|(?=<(?:rb|rtc)\b|$))/giu;
const RUBY_TEXT = /<(rt|rp)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|(?=<(?:rb|rt|rp)\b|$))/giu;

/** Ruby as its base text alone: 漢字 with its reading becomes 漢字. */
const withoutRubyText = (html: string): string =>
  html.replace(/<ruby\b[^>]*>([\s\S]*?)<\/ruby\s*>/giu, (_whole: string, inside: string) => inside.replace(RUBY_TEXT_CONTAINER, "").replace(RUBY_TEXT, ""));

const ANY_LINK = /<a\b[^>]*>[\s\S]*?<\/a\s*>/giu;

/**
 * A link that moves within the page (a table of contents, "back to top"), through a series (rel="prev" / "next"), or
 * goes nowhere and runs a script instead (href="javascript:…", a print or share button).
 */
const isChromeLink = (link: string): boolean =>
  /^<a\b[^>]*\bhref\s*=\s*(?:["']\s*)?(?:#|javascript:)/iu.test(link) || /^<a\b[^>]*\brel\s*=\s*(?:["'][^"']*\b)?(?:prev|next)\b/iu.test(link);

/** A list whose every item is only a link, such as a site menu or a table of contents. */
const isNavigation = (body: string): boolean => (body.match(ANY_LINK) ?? []).length > 0 && stripTags(body.replace(ANY_LINK, "")).trim() === "";

/** Attributes before role="main", each skipped whole so that a quoted value (title="x role=main") is not read as one. */
const ATTRIBUTES = String.raw`(?:\s+[^\s"'>=/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*?`;

// A role is a list of tokens and the first one counts: role="main document" is main.
const MAIN_ROLE = String.raw`${ATTRIBUTES}\s+role\s*=\s*(?:"\s*main(?:\s[^"]*)?"|'\s*main(?:\s[^']*)?'|main(?=[\s/>]))`;

/** The first element marked role="main" (a CMS's <article id="contents" role="main">), matched to its own closing tag. */
const mainLandmark = (html: string): string | undefined => {
  const tag = new RegExp(String.raw`<([a-z][a-z0-9]*)${MAIN_ROLE}`, "iu").exec(html)?.[1];
  if (tag === undefined) return undefined;
  return elementRanges(html, tag).find((range) => new RegExp(String.raw`^<[a-z][a-z0-9]*${MAIN_ROLE}`, "iu").test(range.openTag))?.inner;
};

const isOutermost = (range: ElementRange, _index: number, all: readonly ElementRange[]): boolean =>
  !all.some((outer) => outer.start < range.start && range.end <= outer.end);

const holdsEveryTitle = (html: string, range: ElementRange): boolean =>
  [...html.matchAll(/<h1\b/giu)].every((title) => title.index > range.start && title.index < range.end);

/**
 * The one <article> not nested in another, when the page has exactly one and no <h1> outside it: the composition the
 * page was made for. A page title outside the article means the article is only part of the page's content.
 */
const soleArticle = (html: string): string | undefined => {
  const [only, ...others] = elementRanges(html, "article").filter(isOutermost);
  return only !== undefined && others.length === 0 && holdsEveryTitle(html, only) ? only.inner : undefined;
};

/** The page's own content: inside <main>, else the element marked role="main", else a sole <article>, else the whole page. */
const mainContent = (html: string): string => /<main\b[^>]*>([\s\S]*)<\/main\s*>/iu.exec(html)?.[1] ?? mainLandmark(html) ?? soleArticle(html) ?? html;

type ElementRange = { readonly start: number; readonly end: number; readonly openTag: string; readonly inner: string };

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
const elementRanges = (html: string, tag: string): ElementRange[] =>
  [...html.matchAll(new RegExp(`<(/?)${tag}\\b[^>]*>`, "giu"))]
    .reduce<RangeScan>((scan, match) => (match[1] === "/" ? closeLast(html, scan, match) : { open: [...scan.open, match], ranges: scan.ranges }), {
      open: [],
      ranges: [],
    })
    .ranges.toSorted((left, right) => left.start - right.start);

/** The ranges (in document order) each replaced by a space; one inside another cut one goes with it. */
const withoutRanges = (html: string, ranges: readonly ElementRange[]): string => {
  const chosen = ranges.reduce<ElementRange[]>((kept, range) => ((kept.at(-1)?.end ?? 0) > range.start ? kept : [...kept, range]), []);
  const cut = chosen.reduce<{ readonly parts: readonly string[]; readonly from: number }>(
    (acc, range) => ({ parts: [...acc.parts, html.slice(acc.from, range.start), " "], from: range.end }),
    { parts: [], from: 0 },
  );
  return [...cut.parts, html.slice(cut.from)].join("");
};

/** The <tag> elements that are chrome, each replaced by a space; one inside another dropped one goes with it. */
const withoutElementsWhere = (html: string, tag: string, isChrome: (range: ElementRange) => boolean): string =>
  withoutRanges(html, elementRanges(html, tag).filter(isChrome));

const LANDMARK = String.raw`(?:\brole\s*=\s*["']?navigation\b|\baria-label\s*=\s*(?:["'][^"']*|[^\s"'>]*)breadcrumb)`;

const LANDMARK_OPENING = new RegExp(String.raw`<([a-z][a-z0-9]*)\b[^>]*${LANDMARK}`, "giu");

const isLandmark = (range: ElementRange): boolean => new RegExp(`^<[^>]*${LANDMARK}`, "iu").test(range.openTag);

/** Navigation that is not a <nav>: any element with role="navigation", or labelled as a breadcrumb. */
const withoutNavigationLandmarks = (html: string): string => {
  const tags = new Set([...html.matchAll(LANDMARK_OPENING)].map((match) => (match[1] ?? "").toLowerCase()));
  return [...tags].reduce((text, tag) => withoutElementsWhere(text, tag, isLandmark), html);
};

const LINK_MARK = "\u0003";

const hasNoWords = (text: string): boolean => !/[\p{L}\p{N}]/u.test(text);

/** Links joined by ">" or another arrow, then the current page's name as plain text. */
const BREADCRUMB_TRAIL = new RegExp(`^\\s*(?:${LINK_MARK}\\s*[>›»＞→]\\s*){2,}[^${LINK_MARK}>›»＞→]*$`, "u");

/** A link wrapping blocks (a card with a title and a summary) carries content, not a way around the site. */
const isCard = (link: string): boolean => /<(?:div|p|h[1-6]|ul|ol|dl|section|article|figure)\b/iu.test(link);

/** A block made of two or more links and nothing else (a menu, previous and next), or a breadcrumb trail. */
const isLinkGroup = (range: ElementRange): boolean => {
  const links = range.inner.match(ANY_LINK) ?? [];
  const rest = decodeEntities(stripTags(range.inner.replace(ANY_LINK, LINK_MARK)));
  if (links.length === 0 || links.some(isCard)) return false;
  if (hasNoWords(rest.replaceAll(LINK_MARK, ""))) return links.length >= 2;
  return BREADCRUMB_TRAIL.test(rest);
};

const withoutLinkGroups = (html: string): string => ["div", "section", "p"].reduce((text, tag) => withoutElementsWhere(text, tag, isLinkGroup), html);

const plainText = (html: string): string => decodeEntities(stripTags(html)).replace(/\s+/gu, " ").trim();

type PageTitle = { readonly text: string; readonly start: number };

/** The page's first <h1>: what it reads and where it opens. */
const pageTitle = (html: string): PageTitle | undefined => {
  const title = /<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/iu.exec(html);
  return title === null ? undefined : { text: plainText(title[1] ?? ""), start: title.index };
};

const MIN_TRAIL_LINKS = 2;

/**
 * A breadcrumb as a list above the page's title: two or more items that are each only a link, then the title itself as
 * the last item. The same list further down is the page's own content (steps ending in the one this page is about).
 */
const isBreadcrumbList = (body: string, at: number, title: PageTitle | undefined): boolean => {
  const items = body.split(/<li\b[^>]*>/iu).slice(1);
  const current = items.at(-1);
  const trail = items.slice(0, -1);
  return (
    title !== undefined &&
    at < title.start &&
    current !== undefined &&
    plainText(current) === title.text &&
    trail.length >= MIN_TRAIL_LINKS &&
    trail.every(isNavigation)
  );
};

/** From the inside out, so a nested table of contents goes too once its inner lists are gone. */
const withoutNavigation = (html: string): string =>
  untilStable(html, (text) => {
    const title = pageTitle(text);
    return text.replace(/<(ul|ol)\b[^>]*>((?:(?!<[uo]l\b)[\s\S])*?)<\/\1\s*>/giu, (whole: string, _tag: string, body: string, at: number) =>
      isNavigation(body) || isBreadcrumbList(body, at, title) ? " " : whole,
    );
  });

const DEFINITION = /<dd\b[^>]*>([\s\S]*?)(?:<\/dd\s*>|(?=<d[dt]\b)|$)/giu;

/** A definition list whose every definition is only links: a menu with its label as the term ("文字サイズ: 標準 大"). */
const isLabelledMenu = (list: string): boolean => {
  const definitions = [...list.matchAll(DEFINITION)].map((match) => match[1] ?? "");
  return definitions.length > 0 && definitions.every(isNavigation);
};

const isDefinitionList = (range: ElementRange): boolean => /^<dl\b/iu.test(range.openTag);

const holdsMenu = (range: ElementRange): boolean =>
  withoutNavigation(range.inner) !== range.inner ||
  (isDefinitionList(range) && isLabelledMenu(range.inner)) ||
  elementRanges(range.inner, "dl").some((list) => isLabelledMenu(list.inner));

const HEADER_BLOCKS = ["div", "section", "header", "dl"];

/**
 * A block that closes before the page's title opens and holds a menu is the site's header: it goes whole, with the
 * tagline and labels beside the menu. A block before the title without a menu (an agency and docket number) is kept.
 */
const withoutSiteHeader = (html: string): string => {
  const title = pageTitle(html);
  if (title === undefined) return html;
  const before = HEADER_BLOCKS.flatMap((tag) => elementRanges(html, tag)).filter((range) => range.end <= title.start);
  return withoutRanges(
    html,
    before.filter(holdsMenu).toSorted((left, right) => left.start - right.start),
  );
};

// An in-page link is wrapped in these marks so that one standing alone on its line ("Jump to main text") can be told
// from one inside a sentence ("see Table 1"); the first is dropped, the second keeps its text.
const LINK_START = "\u0001";
const LINK_END = "\u0002";

const markChromeLinks = (html: string): string =>
  html.replace(ANY_LINK, (link: string) => (isChromeLink(link) ? `${LINK_START}${stripTags(link)}${LINK_END}` : link));

const MARKED_LINK = new RegExp(`${LINK_START}[^${LINK_END}]*${LINK_END}`, "gu");

/** A line of in-page or paging links and at most a mark such as "▲" or "|" between them. */
const isChromeLinkLine = (line: string): boolean => line.includes(LINK_START) && hasNoWords(line.replace(MARKED_LINK, ""));

const COPYRIGHT_NOTICE = /^(?:copyright\s*)?(?:©|\(c\)|copyright)\s*\d{4}\b/iu;

/** A copyright notice at the very end of the page, where a site puts it when it has no <footer>. */
const withoutClosingCopyright = (lines: readonly string[]): string[] => {
  const last = lines.findLastIndex((line) => line !== "");
  return last >= 0 && COPYRIGHT_NOTICE.test(lines[last] ?? "") ? withoutClosingCopyright(lines.slice(0, last)) : [...lines];
};

const headingLevel = (line: string): number => /^#{1,6} /u.exec(line)?.[0].length ?? 0;

/** Headings with nothing under them before the next heading of the same or a higher level: what dropped navigation left. */
const withoutEmptySections = (lines: readonly string[]): string[] =>
  lines.reduceRight<{ readonly kept: string[]; readonly nextLevel: number }>(
    (state, line) => {
      if (line === "") return { kept: [line, ...state.kept], nextLevel: state.nextLevel };
      const level = headingLevel(line) - 1;
      if (level < 0) return { kept: [line, ...state.kept], nextLevel: Number.POSITIVE_INFINITY };
      if (state.nextLevel <= level) return state;
      return { kept: [line, ...state.kept], nextLevel: level };
    },
    { kept: [], nextLevel: 0 },
  ).kept;

const BLOCK_TAGS = new Set([
  "p",
  "div",
  "ul",
  "ol",
  "hr",
  "blockquote",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "aside",
  "dl",
  "dt",
  "dd",
  "figure",
  "figcaption",
  "pre",
  "body",
  "html",
]);

const heading = (_whole: string, level: string, inside: string): string => `\n\n${"#".repeat(Number(level))} ${stripTags(inside).trim()}\n\n`;

const asLines = (html: string): string =>
  html
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/giu, heading)
    .replace(/<li\b[^>]*>/giu, "\n- ")
    .replace(/<\/li\s*>/giu, "")
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/giu, (whole: string, tag: string) => (BLOCK_TAGS.has(tag.toLowerCase()) ? "\n\n" : whole));

export const htmlToMarkdown = (html: string): string => {
  const kept = mainContent(DROPPED.reduce(withoutElement, withoutRubyText(html.replace(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>/gu, ""))))
    .replace(/<sup\b[^>]*>\s*<a\b[^>]*>[^<]*<\/a\s*>\s*<\/sup\s*>/giu, "")
    .replace(/\s+/gu, " ");
  const text = decodeEntities(stripTags(asLines(markChromeLinks(withoutLinkGroups(withoutNavigation(withoutSiteHeader(withoutNavigationLandmarks(kept))))))));
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "-" && !isChromeLinkLine(line))
    .map((line) => line.replaceAll(LINK_START, "").replaceAll(LINK_END, ""));
  return tidyLines(withoutEmptySections(withoutClosingCopyright(withoutEmptySections(lines))));
};
