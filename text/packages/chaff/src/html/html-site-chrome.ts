// The site's own chrome around a page, read from what the markup says a block is rather than from
// any site's wording. A landmark role (banner, search, contentinfo), a <search> element, a <header> that belongs to the
// page rather than to a section, and a block named by a convention CMSs share: a breadcrumb trail (breadcrumb, pankuzu,
// topicpath), a search box, the header or footer block (id or class exactly "header" or "footer"), and the U.S.
// government's ".gov" banner (usa-banner). A block holding the page's <h1> is never chrome. Pure; a regular-expression
// reading, not a parser.
import { ATTRIBUTES, elementRanges, isInside, withoutElementsOpening, withoutRanges, type ElementRange } from "./html-elements.ts";

const CHROME_ROLES = new Set(["banner", "search", "contentinfo"]);

// A name segment, so that "pankuzu_wrap", "foot_pankuzu" and "cse-search-box" match and "research" does not.
const CHROME_NAME = /(?:^|[-_])(?:breadcrumbs?|pankuzu|topic-?path|search)(?:[-_\d]|$)/iu;

const REGION_NAME = /^(?:header|footer|usa-banner)$/iu;

const NAMED_OPENING = /<([a-z][a-z0-9-]*)\b[^>]*\s(?:class|id|role)\s*=/giu;

const attributeValue = (openTag: string, name: string): string => {
  const value = new RegExp(String.raw`^<[a-z][a-z0-9-]*${ATTRIBUTES}\s+${name}\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))`, "iu").exec(openTag);
  return value?.[1] ?? value?.[2] ?? value?.[3] ?? "";
};

const tokens = (value: string): string[] => value.split(/\s+/u).filter((token) => token !== "");

const holdsTitle = (range: ElementRange): boolean => /<h1\b/iu.test(range.inner);

/** A role is a list of tokens and the first one counts, as for role="main". */
const hasChromeRole = (openTag: string): boolean => CHROME_ROLES.has((tokens(attributeValue(openTag, "role"))[0] ?? "").toLowerCase());

const hasChromeName = (openTag: string): boolean =>
  [...tokens(attributeValue(openTag, "class")), ...tokens(attributeValue(openTag, "id"))].some((name) => CHROME_NAME.test(name) || REGION_NAME.test(name));

/** A block the markup names or marks as the site's chrome, unless it holds the page's title. */
export const isSiteChrome = (range: ElementRange): boolean => !holdsTitle(range) && (hasChromeRole(range.openTag) || hasChromeName(range.openTag));

const SECTIONING = ["article", "section", "main", "aside", "nav"];

/** A <header> inside an article or a section heads that part; one outside them is the page's banner. */
const withoutPageHeaders = (html: string): string => {
  const sections = SECTIONING.flatMap((tag) => elementRanges(html, tag));
  const banners = elementRanges(html, "header").filter((header) => !holdsTitle(header) && !sections.some((section) => isInside(section, header)));
  return withoutRanges(html, banners);
};

const withoutSearchElements = (html: string): string => withoutRanges(html, elementRanges(html, "search"));

export const withoutSiteChrome = (html: string): string => withoutPageHeaders(withoutSearchElements(withoutElementsOpening(html, NAMED_OPENING, isSiteChrome)));
