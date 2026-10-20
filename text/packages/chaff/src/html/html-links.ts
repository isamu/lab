// Where a page's links point, kept without changing its text. A link's text stays as it is read; its address, when
// it is an absolute http(s) one, goes into a comment closing the section the link is in (<!-- https://… -->), so the
// document still holds what the section links to while the sentences are untouched. A relative address names no page
// without the page's own address, and a link without text is a picture. Pure.
import { ANY_LINK, hrefOf, stripTags } from "./html-elements.ts";
import { decodeEntities } from "./markup-text.ts";

const ADDRESS_START = "\u0004";
const ADDRESS_END = "\u0005";

const MARKED_ADDRESS = new RegExp(`${ADDRESS_START}([^${ADDRESS_END}]*)${ADDRESS_END}`, "gu");

const ABSOLUTE_WEB = /^https?:\/\/[^\s/?#]+/iu;

// Escaped as a browser sends them: a space would split the comment's list, a control character (the marks among
// them) would break the line or the mark, and "<", ">" and a second "-" would end or break the comment.
const UNSAFE_IN_COMMENT = /[\s\p{Cc}<>]|(?<=-)-/gu;

const percentEncoded = (character: string): string => (character === "-" ? "%2D" : encodeURIComponent(character));

/**
 * The address as it will be read once the page's character references are decoded: decoded and escaped here, its
 * "&" written back as a reference so that the one decoding left gives the address again.
 */
const address = (href: string): string => decodeEntities(href).trim().replace(UNSAFE_IN_COMMENT, percentEncoded).replaceAll("&", "&amp;");

const hasText = (link: string): boolean => decodeEntities(stripTags(link)).trim() !== "";

const marked = (link: string): string => {
  const href = hrefOf(link);
  if (!ABSOLUTE_WEB.test(decodeEntities(href).trim()) || !hasText(link)) return link;
  return link.replace(/<\/a\s*>$/iu, `${ADDRESS_START}${address(href)}${ADDRESS_END}$&`);
};

/** Each link to an absolute web address with its address marked after its text, for withSectionLinks to collect. */
export const withLinkAddressesMarked = (html: string): string => html.replace(ANY_LINK, marked);

const HEADING = /^#{1,6} /u;

const SPACED_MARK = new RegExp(`( ?)${MARKED_ADDRESS.source}( ?)`, "gu");

/**
 * A mark goes with the spacing the text had without it: between two spaces (a link's text ending in one) it leaves
 * one, and a space it kept at the line's edge from the trimming goes.
 */
const withoutMarks = (line: string): string =>
  line.replace(SPACED_MARK, (mark: string, before: string, _address: string, after: string, at: number) => {
    if (before !== "" && after !== "") return " ";
    return at === 0 || at + mark.length === line.length ? "" : `${before}${after}`;
  });

const closing = (addresses: readonly string[]): string[] => (addresses.length === 0 ? [] : ["", `<!-- ${addresses.join(" ")} -->`, ""]);

/** The lines without their marks, each section closed by a comment listing the addresses its lines linked to. */
export const withSectionLinks = (lines: readonly string[]): string[] => {
  const kept: string[] = [];
  const pending: string[] = [];
  const close = (): void => {
    kept.push(...closing(pending));
    pending.length = 0;
  };
  lines.forEach((line) => {
    const text = withoutMarks(line);
    if (HEADING.test(text)) close();
    kept.push(text);
    pending.push(...[...line.matchAll(MARKED_ADDRESS)].map((mark) => mark[1] ?? ""));
  });
  close();
  return kept;
};
