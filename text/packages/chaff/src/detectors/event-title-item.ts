// The titles in a list of past talks and events: an item that is one quoted title (- 「…の改善」), or an item that closes with
// the event's date in brackets (- …の進め方～（2014/1/9）), when the list dates two or more items so. In such a list, an item
// that names a kind of talk and brackets its title (- 講演（…EBPM研修への取り組み）, the title may run onto the next line) is a
// title too. A title is the speaker's or the organiser's words, which the page cannot change, so undefined-acronym counts its
// acronyms but does not ask to spell them out. Pure: the kinds of talk come from the language's lexicon talk-kind.
import { oneOf } from "./acronym-name.ts";

type Span = { readonly start: number; readonly end: number };

const ITEM_MARK = String.raw`[ \t]*(?:[-*+]|\d+[.)])[ \t]+`;
const ITEM = new RegExp(String.raw`^${ITEM_MARK}(?<content>\S.*)$`, "gmu");
/** Brackets after the title that only annotate it: its date, the file it links (（2014/2/21）（PDF）). */
const NOTE = String.raw`[(（][^()（）\n]{1,20}[)）]`;
/** A title holds no full stop: a quote of whole sentences (- 「…で転落。ICU入室。」(4歳)) reports what someone said, and is the writer's choice. */
const QUOTED_TITLE = new RegExp(String.raw`^「[^「」。\n]+」(?:\s*${NOTE})*$`, "u");
const DATE = String.raw`\d{4}(?:[/／.-]\d{1,2}){1,2}|\d{4}年\d{1,2}月(?:\d{1,2}日)?`;
const DATED = new RegExp(String.raw`[(（](?:${DATE})[)）](?:\s*${NOTE})*$`, "u");
/** A list dates its items when this many of them close with a date. */
const DATED_ITEMS = 2;
/** One line of a bracketed title: no brackets and no full stop. */
const TITLE_LINE = String.raw`[^()（）。\n]+`;
/** The line an item's title runs onto: not blank, not another item, not a heading. */
const CONTINUED_LINE = String.raw`\n(?!${ITEM_MARK})(?![ \t]*#)(?=[ \t]*\S)${TITLE_LINE}`;

/** An item that is a kind of talk and its bracketed title, which may run onto one more line. */
const kindItemPattern = (kinds: readonly string[]): RegExp =>
  new RegExp(String.raw`^${ITEM_MARK}${oneOf(kinds)}[(（](?<title>${TITLE_LINE}(?:${CONTINUED_LINE})?)[)）](?:[ \t]*${NOTE})*[ \t]*$`, "gmu");

type Item = { readonly content: string; readonly start: number };

const itemsOf = (source: string): Item[] =>
  [...source.matchAll(ITEM)].map((match) => {
    const content = (match.groups?.["content"] ?? "").trimEnd();
    return { content, start: match.index + match[0].indexOf(content) };
  });

const spanOf = (item: Item): Span => ({ start: item.start, end: item.start + item.content.length });

const kindTitleSpans = (source: string, kinds: readonly string[]): Span[] =>
  kinds.length === 0
    ? []
    : [...source.matchAll(kindItemPattern(kinds))].map((match) => {
        const title = match.groups?.["title"] ?? "";
        const start = match.index + match[0].indexOf(title);
        return { start, end: start + title.length };
      });

/** The spans of the event titles in the source's list items. kinds: the kinds of talk (講演, keynote). */
export const eventTitleSpans = (source: string, kinds: readonly string[]): Span[] => {
  const items = itemsOf(source);
  const dated = items.filter((item) => DATED.test(item.content));
  const datedList = dated.length >= DATED_ITEMS;
  return [
    ...items.filter((item) => QUOTED_TITLE.test(item.content)).map(spanOf),
    ...(datedList ? [...dated.map(spanOf), ...kindTitleSpans(source, kinds)] : []),
  ];
};
