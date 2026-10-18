// The site's own chrome around a page, read from what the markup says a block is rather than from
// any site's wording. A landmark role (banner, search, contentinfo), a <search> element, a <header> that belongs to the
// page rather than to a section, and a block named by a convention CMSs share: a breadcrumb trail (breadcrumb, pankuzu,
// topicpath), a search box, the header or footer block (id or class exactly "header" or "footer"), and the U.S.
// government's ".gov" banner (usa-banner). A block holding the page's <h1> is never chrome, nor a header holding a
// heading followed by prose, nor a search block holding prose (a results page). Pure; a regular-expression reading,
// not a parser.
import {
  ANY_LINK,
  ATTRIBUTES,
  CLOSED_SENTENCE,
  elementRanges,
  headingRanges,
  isInside,
  plainText,
  withoutElementsOpening,
  withoutRanges,
  type ElementRange,
} from "./html-elements.ts";

const CHROME_ROLES = new Set(["banner", "contentinfo"]);

// A name segment, so that "pankuzu_wrap" and "foot_pankuzu" match and "research" does not.
const CHROME_NAME = /(?:^|[-_])(?:breadcrumbs?|pankuzu|topic-?path)(?:[-_\d]|$)/iu;

const SEARCH_NAME = /(?:^|[-_])search(?:[-_\d]|$)/iu;

const REGION_NAME = /^(?:footer|usa-banner)$/iu;

const HEADER_NAME = /^header$/iu;

// A form's own controls, also when the form element itself is gone and only its labels remain.
const FORM_CONTROL = /<(?:input|select|textarea|button|label|fieldset)\b/iu;

/** From this many sentences a block is prose, not a search box: a results page, an article named "search-…". */
const PROSE_SENTENCES = 2;

const NAMED_OPENING = /<([a-z][a-z0-9-]*)\b[^>]*\s(?:class|id|role)\s*=/giu;

const attributeValue = (openTag: string, name: string): string => {
  const value = new RegExp(String.raw`^<[a-z][a-z0-9-]*${ATTRIBUTES}\s+${name}\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))`, "iu").exec(openTag);
  return value?.[1] ?? value?.[2] ?? value?.[3] ?? "";
};

const tokens = (value: string): string[] => value.split(/\s+/u).filter((token) => token !== "");

const holdsTitle = (range: ElementRange): boolean => /<h1\b/iu.test(range.inner);

const SENTENCE_ENDS = new RegExp(CLOSED_SENTENCE.source, "gu");

/** Each tag read as a space, as hasSentence does, so that "Done.</li><li>Next" ends one. */
const sentenceCount = (html: string): number => [...plainText(html.replace(/<\/?[a-z!][^>]*>/giu, " ")).matchAll(SENTENCE_ENDS)].length;

/** The block's own running text: what is left without its links (a menu) and its headings (a title, a menu's labels). */
const ownSentences = (html: string): number => sentenceCount(withoutRanges(html, headingRanges(html)).replace(ANY_LINK, " "));

const isProse = (html: string): boolean => ownSentences(html) >= PROSE_SENTENCES;

const holdsSentence = (html: string): boolean => ownSentences(html) > 0;

/** A heading with a sentence after it: a part of the document, not a site's logo over its menu. */
const holdsHeadedProse = (range: ElementRange): boolean => headingRanges(range.inner).some((heading) => holdsSentence(range.inner.slice(heading.end)));

/** A search box or its menu: a form, controls, or links with no sentence of their own; never prose such as a results page. */
const isSearchBox = (range: ElementRange): boolean =>
  !isProse(range.inner) && (/^<form\b/iu.test(range.openTag) || FORM_CONTROL.test(range.inner) || !holdsSentence(range.inner));

const firstRole = (openTag: string): string => (tokens(attributeValue(openTag, "role"))[0] ?? "").toLowerCase();

const names = (openTag: string): string[] => [...tokens(attributeValue(openTag, "class")), ...tokens(attributeValue(openTag, "id"))];

/** A role is a list of tokens and the first one counts, as for role="main". */
const hasChromeRole = (openTag: string): boolean => CHROME_ROLES.has(firstRole(openTag));

const hasChromeName = (openTag: string): boolean => names(openTag).some((name) => CHROME_NAME.test(name) || REGION_NAME.test(name));

/** The search landmark is chrome as marked; a name is only a hint, so the block must also look like a search box. */
const isSearchBlock = (range: ElementRange): boolean =>
  firstRole(range.openTag) === "search" ? !isProse(range.inner) : names(range.openTag).some((name) => SEARCH_NAME.test(name)) && isSearchBox(range);

const isHeaderBlock = (range: ElementRange): boolean => names(range.openTag).some((name) => HEADER_NAME.test(name)) && !holdsHeadedProse(range);

/** A block the markup names or marks as the site's chrome, unless it holds the page's title. */
export const isSiteChrome = (range: ElementRange): boolean =>
  !holdsTitle(range) && (hasChromeRole(range.openTag) || hasChromeName(range.openTag) || isSearchBlock(range) || isHeaderBlock(range));

const SECTIONING = ["article", "section", "main", "aside", "nav"];

/** A <header> inside an article or a section heads that part; one outside them is the page's banner. */
const withoutPageHeaders = (html: string): string => {
  const sections = SECTIONING.flatMap((tag) => elementRanges(html, tag));
  const banners = elementRanges(html, "header").filter(
    (header) => !holdsTitle(header) && !holdsHeadedProse(header) && !sections.some((section) => isInside(section, header)),
  );
  return withoutRanges(html, banners);
};

const withoutSearchElements = (html: string): string =>
  withoutRanges(
    html,
    elementRanges(html, "search").filter((search) => !isProse(search.inner)),
  );

export const withoutSiteChrome = (html: string): string => withoutPageHeaders(withoutSearchElements(withoutElementsOpening(html, NAMED_OPENING, isSiteChrome)));
