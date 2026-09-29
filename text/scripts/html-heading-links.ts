// A heading's link to its own section (a permalink beside or after the title), taken out of an HTML page. Pure.
import { ANY_LINK, ATTRIBUTES, elementRanges, hasNoWords, plainText, type ElementRange } from "./html-elements.ts";
import { decodeEntities } from "./markup-text.ts";

const ID = new RegExp(String.raw`<([a-z][a-z0-9-]*)${ATTRIBUTES}\s+id\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))`, "giu");

type IdTarget = { readonly start: number; readonly tag: string };

/** Where each id's element opens, and which element it is; the first one when an id is repeated. */
const idTargets = (html: string): Map<string, IdTarget> =>
  [...html.matchAll(ID)].reduce((targets, match) => {
    const id = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
    return targets.has(id) ? targets : targets.set(id, { start: match.index, tag: (match[1] ?? "").toLowerCase() });
  }, new Map<string, IdTarget>());

const FRAGMENT = /^<a\b[^>]*\bhref\s*=\s*["']?[^"'#\s>]*#([^"'\s>]+)/iu;

/** The id a link's fragment names, its character references and percent escapes undone. */
const fragmentId = (link: string): string | undefined => {
  const fragment = FRAGMENT.exec(link)?.[1];
  if (fragment === undefined) return undefined;
  const decoded = decodeEntities(fragment);
  try {
    return decodeURIComponent(decoded);
  } catch {
    return decoded;
  }
};

const HEADING_OPENING = /<h[1-6]\b/iu;

type PageIds = {
  readonly ids: ReadonlyMap<string, IdTarget>;
  readonly html: string;
  readonly rangesOf: (tag: string) => readonly ElementRange[];
};

type HeadingPlace = PageIds & { readonly start: number; readonly end: number };

/** The target opens before the heading and closes after it, with no other heading opening in between. */
const isSectionOf = (target: IdTarget, place: HeadingPlace): boolean =>
  place.rangesOf(target.tag).some((range) => range.start === target.start && range.end >= place.end) &&
  !HEADING_OPENING.test(place.html.slice(target.start, place.start));

/** A link to the heading's own section: the heading, something inside it, or the block it opens (a permalink, "Copy link to Context"). */
const isSelfLink = (link: string, place: HeadingPlace): boolean => {
  const id = fragmentId(link);
  const target = id === undefined ? undefined : place.ids.get(id);
  if (target === undefined || target.start >= place.end) return false;
  return target.start >= place.start || isSectionOf(target, place);
};

/** A permalink mark inside the heading (¶, #, an icon); a self-link with words is the title, or part of it. */
const isPermalinkMark = (link: string, place: HeadingPlace): boolean => hasNoWords(plainText(link)) && isSelfLink(link, place);

const HEADING_THEN_LINK = /(<h([1-6])\b[^>]*>)([\s\S]*?)(<\/h\2\s*>)(\s*<a\b[^>]*>[\s\S]*?<\/a\s*>)?/giu;

/** The heading as matched, without its permalink marks or the self-link standing after it. */
const headingWithoutSelfLinks = (match: RegExpExecArray, page: PageIds): string => {
  const [, open = "", , inside = "", close = "", after] = match;
  const place = { ...page, start: match.index, end: match.index + open.length + inside.length + close.length };
  const kept = inside.replace(ANY_LINK, (link: string) => (isPermalinkMark(link, place) ? " " : link));
  const next = after === undefined || isSelfLink(after.trim(), place) ? "" : after;
  return `${open}${kept}${close}${next}`;
};

/** elementRanges for each tag, computed once. */
const rangesByTag = (html: string): ((tag: string) => readonly ElementRange[]) => {
  const cache = new Map<string, readonly ElementRange[]>();
  return (tag: string) => {
    const known = cache.get(tag);
    if (known !== undefined) return known;
    const ranges = elementRanges(html, tag);
    cache.set(tag, ranges);
    return ranges;
  };
};

/**
 * A heading's link to its own section goes when it stands just after the heading ("Copy link to Context"), or inside
 * it as a mark without words ("Scope ¶"). A link with words inside the heading is its title and stays.
 */
export const withoutHeadingSelfLinks = (html: string): string => {
  const page = { ids: idTargets(html), html, rangesOf: rangesByTag(html) };
  const cut = [...html.matchAll(HEADING_THEN_LINK)].reduce<{ readonly parts: readonly string[]; readonly from: number }>(
    (acc, match) => ({
      parts: [...acc.parts, html.slice(acc.from, match.index), headingWithoutSelfLinks(match, page)],
      from: match.index + match[0].length,
    }),
    { parts: [], from: 0 },
  );
  return [...cut.parts, html.slice(cut.from)].join("");
};
