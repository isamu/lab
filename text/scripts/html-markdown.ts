// An HTML page (a CRS report as EveryCRSReport serves it, a ministry's page) as plain Markdown: headings, paragraphs,
// list items and the text of links; ruby keeps its base text and loses its reading. Only the <main> element (else the
// role="main" element, else a sole <article>) is read when the page has one. Scripts, styles, the head, navigation (by
// element or by role, and breadcrumbs), asides, footers, forms, tables, footnote marks, lists and blocks of nothing but
// links (a menu, a table of contents, previous/next links, a breadcrumb trail, also as a list ending in the page's
// title), a block before the page's title that holds a menu or only links and no sentence (the site's header, with its tagline and
// labels), buttons outside a heading, hidden elements, text for a screen reader only (a visually-hidden class, a skip
// link's target), a heading's link to its own section beside or after its title,
// lines of nothing but in-page or script links (never a heading), a heading drawn as an image unless its alt text is the page's
// title, blocks of nothing but links closing the page, and a copyright notice closing the page, with an address just
// before it, are dropped. Markup's spacing collapses; U+3000 is text and stays. Pure; a regular-expression reading that
// is enough for the documents in the corpus, not a parser for any HTML.
import {
  ANY_LINK,
  ATTRIBUTES,
  asMarkup,
  elementRanges,
  hasNoWords,
  isInside,
  plainText,
  stripTags,
  withAttributeMarkupEscaped,
  type ElementRange,
} from "./html-elements.ts";
import { withoutHeadingSelfLinks } from "./html-heading-links.ts";
import { withPreformattedRestored, withPreformattedStashed } from "./html-preformatted.ts";
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

// HTML lets a ruby's parts omit their closing tags: a reading container (<rtc>) ends at the next <rb> or <rtc>, a
// reading (<rt>) or its bracket (<rp>) at the next <rb>, <rt> or <rp>; any of them at the end of the <ruby>.
const RUBY_TEXT_CONTAINER = /<rtc\b[^>]*>[\s\S]*?(?:<\/rtc\s*>|(?=<(?:rb|rtc)\b|$))/giu;
const RUBY_TEXT = /<(rt|rp)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|(?=<(?:rb|rt|rp)\b|$))/giu;

/** Ruby as its base text alone: 漢字 with its reading becomes 漢字. */
const withoutRubyText = (html: string): string =>
  html.replace(/<ruby\b[^>]*>([\s\S]*?)<\/ruby\s*>/giu, (_whole: string, inside: string) => inside.replace(RUBY_TEXT_CONTAINER, "").replace(RUBY_TEXT, ""));

/**
 * A link that moves within the page (a table of contents, "back to top"), through a series (rel="prev" / "next"), or
 * goes nowhere and runs a script instead (href="javascript:…", a print or share button).
 */
const isChromeLink = (link: string): boolean =>
  /^<a\b[^>]*\bhref\s*=\s*(?:["']\s*)?(?:#|javascript:)/iu.test(link) || /^<a\b[^>]*\brel\s*=\s*(?:["'][^"']*\b)?(?:prev|next)\b/iu.test(link);

/** A list whose every item is only a link, such as a site menu or a table of contents. */
const isNavigation = (body: string): boolean => [...body.matchAll(ANY_LINK)].length > 0 && stripTags(body.replace(ANY_LINK, "")).trim() === "";

// A role is a list of tokens and the first one counts: role="main document" is main.
const MAIN_ROLE = String.raw`${ATTRIBUTES}\s+role\s*=\s*(?:"\s*main(?:\s[^"]*)?"|'\s*main(?:\s[^']*)?'|main(?=[\s/>]))`;

/** The first element marked role="main" (a CMS's <article id="contents" role="main">), matched to its own closing tag. */
const mainLandmark = (html: string): string | undefined => {
  const tag = new RegExp(String.raw`<([a-z][a-z0-9]*)${MAIN_ROLE}`, "iu").exec(html)?.[1];
  if (tag === undefined) return undefined;
  return elementRanges(html, tag).find((range) => new RegExp(String.raw`^<[a-z][a-z0-9]*${MAIN_ROLE}`, "iu").test(range.openTag))?.inner;
};

const isOutermost = (range: ElementRange, _index: number, all: readonly ElementRange[]): boolean => !all.some((outer) => isInside(outer, range));

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

/** The ranges (in document order) each replaced by a space; one inside another cut one goes with it. */
const withoutRanges = (html: string, ranges: readonly ElementRange[]): string => {
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
const withoutElementsWhere = (html: string, tag: string, isChrome: (range: ElementRange) => boolean): string =>
  withoutRanges(html, elementRanges(html, tag).filter(isChrome));

const LANDMARK = String.raw`(?:\brole\s*=\s*["']?navigation\b|\baria-label\s*=\s*(?:["'][^"']*|[^\s"'>]*)breadcrumb)`;

const LANDMARK_OPENING = new RegExp(String.raw`<([a-z][a-z0-9]*)\b[^>]*${LANDMARK}`, "giu");

const isLandmark = (range: ElementRange): boolean => new RegExp(`^<[^>]*${LANDMARK}`, "iu").test(range.openTag);

/** Every <tag> whose opening matches, for each tag that opens that way, replaced by a space. */
const withoutElementsOpening = (html: string, opening: RegExp, isChrome: (range: ElementRange) => boolean): string => {
  const tags = new Set([...html.matchAll(opening)].map((match) => (match[1] ?? "").toLowerCase()));
  return [...tags].reduce((text, tag) => withoutElementsWhere(text, tag, isChrome), html);
};

/** Navigation that is not a <nav>: any element with role="navigation", or labelled as a breadcrumb. */
const withoutNavigationLandmarks = (html: string): string => withoutElementsOpening(html, LANDMARK_OPENING, isLandmark);

// hidden="until-found" is found by the browser's search and opened, so its text is the page's.
const HIDDEN = String.raw`${ATTRIBUTES}\s+hidden(?=[\s/>=])(?!\s*=\s*(?:"until-found"|'until-found'|until-found(?=[\s/>])))`;

const HIDDEN_OPENING = new RegExp(String.raw`<([a-z][a-z0-9-]*)${HIDDEN}`, "giu");

const isHidden = (range: ElementRange): boolean => new RegExp(String.raw`^<[a-z][a-z0-9-]*${HIDDEN}`, "iu").test(range.openTag);

/** Elements the page does not show (the hidden attribute): a tooltip, a closed menu. */
const withoutHiddenElements = (html: string): string => withoutElementsOpening(html, HIDDEN_OPENING, isHidden);

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"];

const headingRanges = (html: string): ElementRange[] => HEADING_TAGS.flatMap((tag) => elementRanges(html, tag));

// The class names that frameworks and style guides give text written for a screen reader alone (sr-only,
// visually-hidden, govuk-visually-hidden, screen-reader-text), never negated (not-sr-only shows it); "hidden" only as
// a whole name (not hidden-xs).
const READER_ONLY_CLASS = /^(?:(?!not-)[a-z0-9]+-)*(?:sr-only|visually-?hidden|screen-reader-text|element-invisible)$/iu;

const CLASS_OPENING = /<([a-z][a-z0-9-]*)\b[^>]*\sclass\s*=/giu;

const CLASS_VALUE = new RegExp(String.raw`^<[a-z][a-z0-9-]*${ATTRIBUTES}\s+class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))`, "iu");

/** A breakpoint variant (md:block) shows the element on a wider screen, so "hidden" beside one hides it only on some. */
const isReaderOnlyClass = (range: ElementRange): boolean => {
  const value = CLASS_VALUE.exec(range.openTag);
  const names = (value?.[1] ?? value?.[2] ?? value?.[3] ?? "").split(/\s+/u);
  return names.some((name) => READER_ONLY_CLASS.test(name)) || (names.includes("hidden") && !names.some((name) => name.includes(":")));
};

/** An anchor with no href that only a script can focus: where a skip link moves the reader ("ここから本文です。"). */
const isFocusTarget = (range: ElementRange): boolean =>
  !/\shref\s*=/iu.test(range.openTag) && /\stabindex\s*=\s*(?:"\s*-1\s*"|'\s*-1\s*'|-1(?=[\s/>]))/iu.test(range.openTag);

/** Nothing but markup on either side: the anchor is a block of its own, not a word in a sentence. */
const standsAlone = (html: string, range: ElementRange): boolean =>
  html.slice(html.lastIndexOf(">", range.start - 1) + 1, range.start).trim() === "" &&
  html.slice(range.end, html.indexOf("<", range.end) === -1 ? html.length : html.indexOf("<", range.end)).trim() === "";

/**
 * Text the page writes for a screen reader and does not show. A focus target counts only standing alone outside a
 * heading: inside a heading it is the heading's title, inside a sentence a word of it.
 */
const withoutReaderOnlyText = (html: string): string => {
  const headings = headingRanges(html);
  const isReaderTarget = (anchor: ElementRange): boolean =>
    isFocusTarget(anchor) && standsAlone(html, anchor) && !headings.some((heading) => isInside(heading, anchor));
  const targets = withoutElementsWhere(html, "a", isReaderTarget);
  return withoutElementsOpening(targets, CLASS_OPENING, isReaderOnlyClass);
};

/**
 * Buttons are controls ("Close", "Share", "Cite this publication"), not prose, except one inside a heading, which is
 * how an accordion draws its section's title.
 */
const withoutButtons = (html: string): string => {
  const headings = headingRanges(html);
  return withoutElementsWhere(html, "button", (button) => !headings.some((heading) => isInside(heading, button)));
};

const LINK_MARK = "\u0003";

/** Links joined by ">" or another arrow, then the current page's name as plain text. */
const BREADCRUMB_TRAIL = new RegExp(`^\\s*(?:${LINK_MARK}\\s*[>›»＞→]\\s*){2,}[^${LINK_MARK}>›»＞→]*$`, "u");

/** A link wrapping blocks (a card with a title and a summary) carries content, not a way around the site. */
const isCard = (link: string): boolean => /<(?:div|p|h[1-6]|ul|ol|dl|section|article|figure)\b/iu.test(link);

/** The links in html, or none when one of them wraps blocks. */
const plainLinks = (html: string): string[] => {
  const links = [...html.matchAll(ANY_LINK)].map((link) => link[0]);
  return links.some(isCard) ? [] : links;
};

/** The text with each link standing as one mark. */
const withLinksMarked = (html: string): string => decodeEntities(stripTags(html.replace(ANY_LINK, LINK_MARK)));

const isBreadcrumbTrail = (html: string): boolean => plainLinks(html).length > 0 && BREADCRUMB_TRAIL.test(withLinksMarked(html));

const isOnlyLinks = (html: string): boolean => hasNoWords(withLinksMarked(html).replaceAll(LINK_MARK, ""));

const MIN_GROUP_LINKS = 2;

/** A block made of two or more links and nothing else (a menu, previous and next), or a breadcrumb trail. */
const isLinkGroup = (range: ElementRange): boolean => {
  const links = plainLinks(range.inner);
  if (links.length === 0) return false;
  return isOnlyLinks(range.inner) ? links.length >= MIN_GROUP_LINKS : isBreadcrumbTrail(range.inner);
};

/** A block of links and nothing else, even a single one: before the page's title, a way around the site ("English"). */
const isLinksOnly = (range: ElementRange): boolean => plainLinks(range.inner).length > 0 && isOnlyLinks(range.inner);

const withoutLinkGroups = (html: string): string => ["div", "section", "p"].reduce((text, tag) => withoutElementsWhere(text, tag, isLinkGroup), html);

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

/** A list with items and not a word in them: buttons drawn as images, such as a text-size switch. */
const isWordlessList = (body: string): boolean => /<li\b/iu.test(body) && hasNoWords(plainText(body));

/** From the inside out, so a nested table of contents goes too once its inner lists are gone. */
const withoutNavigation = (html: string): string =>
  untilStable(html, (text) => {
    const title = pageTitle(text);
    return text.replace(/<(ul|ol)\b[^>]*>((?:(?!<[uo]l\b)[\s\S])*?)<\/\1\s*>/giu, (whole: string, _tag: string, body: string, at: number) =>
      isNavigation(body) || isWordlessList(body) || isBreadcrumbList(body, at, title) ? " " : whole,
    );
  });

const DEFINITION = /<dd\b[^>]*>([\s\S]*?)(?:<\/dd\s*>|(?=<d[dt]\b)|$)/giu;

const isMenuDefinition = (definition: string): boolean => isNavigation(definition) || isBreadcrumbTrail(definition);

/**
 * A definition list whose every definition is only links or a breadcrumb trail: a menu with its label as the term
 * ("文字サイズ: 標準 大", "現在位置: トップ > 教育 > この頁").
 */
const isLabelledMenu = (list: string): boolean => [...list.matchAll(DEFINITION)].every((definition) => isMenuDefinition(definition[1] ?? ""));

const isDefinitionList = (range: ElementRange): boolean => /^<dl\b/iu.test(range.openTag);

/** What a block holds besides its menus: its link-only lists taken out, or a labelled menu's terms. */
const besideMenus = (range: ElementRange): string =>
  isDefinitionList(range) && isLabelledMenu(range.inner) ? range.inner.replace(DEFINITION, " ") : withoutNavigation(range.inner);

/** A full stop, question or exclamation mark closing a sentence, also before a closing quote or bracket; not the point in "3.5". */
const CLOSED_SENTENCE = /[。．！？]|[.!?][)\]"'”’]*(?=\s|$)/u;

const holdsMenu = (range: ElementRange): boolean => besideMenus(range) !== range.inner || isLinksOnly(range);

/** Nothing but labels beside the menus: a sentence beside a menu makes the block the document's. */
const hasNoSentenceBesideMenus = (range: ElementRange): boolean => !CLOSED_SENTENCE.test(plainText(besideMenus(range)));

const HEADER_BLOCKS = ["div", "section", "header", "dl"];

/**
 * The innermost block that closes before the page's title opens and holds a menu (or only links), with no sentence beside it, is part
 * of the site's header: it goes whole, with the tagline and labels beside the menu. Only the innermost, so that text
 * sharing an outer block with a menu block (an agency and docket number) is kept; so is a block with a sentence in it.
 */
const withoutSiteHeader = (html: string): string => {
  const title = pageTitle(html);
  if (title === undefined) return html;
  const menus = HEADER_BLOCKS.flatMap((tag) => elementRanges(html, tag)).filter((range) => range.end <= title.start && holdsMenu(range));
  const innermost = menus.filter((range) => !menus.some((inner) => isInside(range, inner)));
  return withoutRanges(
    html,
    innermost.filter(hasNoSentenceBesideMenus).toSorted((left, right) => left.start - right.start),
  );
};

const IMAGE = /<img\b[^>]*>/giu;

const ALT = /\salt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/iu;

const altText = (image: string): string => {
  const alt = ALT.exec(image);
  return plainText(alt?.[1] ?? alt?.[2] ?? alt?.[3] ?? "");
};

/** The page's <title>, which names the page wherever it is shown (a tab, a bookmark, a search result). */
const documentTitle = (html: string): string => plainText(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/iu.exec(html)?.[1] ?? "");

/**
 * A heading holding images and nothing else (a logo, a banner, a title set as a picture) carries the images' alt text
 * only when that text is the page's title, which the reader sees drawn there; otherwise it goes whole, since the
 * converter keeps no image's alt text anywhere else either.
 */
const withImageHeadingsRead = (html: string, title: string): string =>
  html.replace(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1\s*>/giu, (whole: string, level: string, attributes: string, inside: string) => {
    const images = inside.match(IMAGE) ?? [];
    if (images.length === 0 || plainText(inside) !== "") return whole;
    const alt = images.map(altText).join(" ").trim();
    return alt !== "" && alt === title ? `<h${level}${attributes}>${asMarkup(alt)}</h${level}>` : " ";
  });

// An in-page link is wrapped in these marks so that one standing alone on its line ("Jump to main text") can be told
// from one inside a sentence ("see Table 1"); the first is dropped, the second keeps its text.
const LINK_START = "\u0001";
const LINK_END = "\u0002";

const markChromeLinks = (html: string): string =>
  html.replace(ANY_LINK, (link: string) => (isChromeLink(link) ? `${LINK_START}${stripTags(link)}${LINK_END}` : link));

const MARKED_LINK = new RegExp(`${LINK_START}[^${LINK_END}]*${LINK_END}`, "gu");

/**
 * A line of in-page or paging links and at most a mark such as "▲" or "|" between them. Never a heading: a heading
 * wrapped in a link back to the table of contents is still the section's title.
 */
const isChromeLinkLine = (line: string): boolean => headingLevel(line) === 0 && line.includes(LINK_START) && hasNoWords(line.replace(MARKED_LINK, ""));

// Without a year only the sign marks a notice: "(c)" alone opens an enumerated paragraph, "Copyright" alone a sentence.
const COPYRIGHT_NOTICE = /^(?:(?:copyright\s*)?(?:©|\(c\)|copyright)\s*\d{4}\b|copyright\s*(?:©|\(c\))|©)/iu;

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

const textLines = (html: string): string[] =>
  decodeEntities(stripTags(asLines(html)))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

const ADDRESS = /<address\b[^>]*>[\s\S]*?<\/address\s*>/giu;

const isOnlyNotices = (html: string): boolean => {
  const lines = textLines(html);
  return lines.length > 0 && lines.every((line) => COPYRIGHT_NOTICE.test(line));
};

const ADDRESS_BLOCKS = ["div", "section"];

/** What the innermost block around the address holds besides it, when it holds anything else. */
const besideAddress = (html: string, address: RegExpExecArray): string | undefined => {
  const end = address.index + address[0].length;
  const around = ADDRESS_BLOCKS.flatMap((tag) => elementRanges(html, tag))
    .filter((range) => range.start < address.index && end <= range.end)
    .toSorted((left, right) => right.start - left.start)
    .map((range) => range.inner.replace(address[0], " "));
  return around.find((beside) => textLines(beside).length > 0);
};

/**
 * An <address> that shares its block with nothing but copyright notices, and has nothing but them after it, closes
 * the page: the site's own contact line, in a footer written without <footer>. An address beside any other text (a
 * label such as "Send comments to:"), with anything else after it, or with nothing after it, is kept.
 */
const withoutClosingAddress = (html: string): string => {
  const last = [...html.matchAll(ADDRESS)].at(-1);
  if (last === undefined) return html;
  const end = last.index + last[0].length;
  const beside = besideAddress(html, last);
  const isFooter = beside !== undefined && isOnlyNotices(beside) && isOnlyNotices(html.slice(end));
  return isFooter ? `${html.slice(0, last.index)} ${html.slice(end)}` : html;
};

const CLOSING_BLOCKS = ["div", "section", "p"];

const HREF = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/iu;

const PAGE_EXTENSION = /^(?:html?|php|aspx?|jsp|cgi)$/iu;

// The host is not part of the path: "https://example.com" names a site, not a file ending in .com.
const SCHEME_AND_HOST = /^(?:[a-z][a-z0-9+.-]*:)?\/\/[^/?#]*/iu;

/** A link to a file (an appendix as PDF, a table as .xlsx) is part of the document; a link to a page is a way around the site. */
const isFileLink = (link: string): boolean => {
  const href = HREF.exec(link);
  const path = (href?.[1] ?? href?.[2] ?? href?.[3] ?? "").replace(SCHEME_AND_HOST, "").split(/[?#]/u)[0] ?? "";
  const extension = /\.([a-z0-9]{1,5})$/iu.exec(path.split("/").at(-1) ?? "")?.[1];
  return extension !== undefined && !PAGE_EXTENSION.test(extension);
};

const isClosingMenu = (text: string, range: ElementRange): boolean =>
  isLinksOnly(range) && !plainLinks(range.inner).some(isFileLink) && textLines(text.slice(range.end)).length === 0;

/** Blocks of links to pages with nothing after them ("一覧に戻る"): a way around the site, as a menu is above the title. */
const withoutClosingLinks = (html: string): string =>
  untilStable(html, (text) => {
    const closing = CLOSING_BLOCKS.flatMap((tag) => elementRanges(text, tag)).filter((range) => isClosingMenu(text, range));
    return withoutRanges(
      text,
      closing.toSorted((left, right) => left.start - right.start),
    );
  });

// Markup's own spacing, collapsed as HTML does; U+3000 is a character Japanese text writes (a clause number and its text), so it stays.
const MARKUP_SPACE = /[^\S\u3000]+/gu;

export const htmlToMarkdown = (html: string): string => {
  const uncommented = withAttributeMarkupEscaped(html).replace(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>/gu, "");
  const preformatted = withPreformattedStashed(DROPPED.reduce(withoutElement, withoutRubyText(uncommented)));
  const kept = withoutHeadingSelfLinks(withoutButtons(withoutReaderOnlyText(withoutHiddenElements(mainContent(preformatted.html)))))
    .replace(/<sup\b[^>]*>\s*<a\b[^>]*>[^<]*<\/a\s*>\s*<\/sup\s*>/giu, "")
    .replace(MARKUP_SPACE, " ");
  const content = withoutClosingLinks(withoutLinkGroups(withoutNavigation(withoutSiteHeader(withoutNavigationLandmarks(withoutClosingAddress(kept))))));
  const text = decodeEntities(stripTags(asLines(markChromeLinks(withImageHeadingsRead(content, documentTitle(uncommented))))));
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "-" && !isChromeLinkLine(line))
    .map((line) => line.replaceAll(LINK_START, "").replaceAll(LINK_END, ""));
  return tidyLines(withPreformattedRestored(withoutEmptySections(withoutClosingCopyright(withoutEmptySections(lines))), preformatted.blocks));
};
