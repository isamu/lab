// The titles in a list of past talks and events: an item that is one quoted title (- 「…の改善」), or an item that closes with
// the event's date in brackets (- …の進め方～（2014/1/9）), when the list dates two or more items so. A title is the
// speaker's or the organiser's words, which the page cannot change, so undefined-acronym counts its acronyms but does not ask
// to spell them out. Pure.

type Span = { readonly start: number; readonly end: number };

const ITEM = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(?<content>\S.*)$/gmu;
/** Brackets after the title that only annotate it: its date, the file it links (（2014/2/21）（PDF）). */
const NOTE = String.raw`[(（][^()（）\n]{1,20}[)）]`;
/** A title holds no full stop: a quote of whole sentences (- 「…で転落。ICU入室。」(4歳)) reports what someone said, and is the writer's choice. */
const QUOTED_TITLE = new RegExp(String.raw`^「[^「」。\n]+」(?:\s*${NOTE})*$`, "u");
const DATE = String.raw`\d{4}(?:[/／.-]\d{1,2}){1,2}|\d{4}年\d{1,2}月(?:\d{1,2}日)?`;
const DATED = new RegExp(String.raw`[(（](?:${DATE})[)）](?:\s*${NOTE})*$`, "u");
/** A list dates its items when this many of them close with a date. */
const DATED_ITEMS = 2;

type Item = { readonly content: string; readonly start: number };

const itemsOf = (source: string): Item[] =>
  [...source.matchAll(ITEM)].map((match) => {
    const content = (match.groups?.["content"] ?? "").trimEnd();
    return { content, start: match.index + match[0].indexOf(content) };
  });

const spanOf = (item: Item): Span => ({ start: item.start, end: item.start + item.content.length });

/** The spans of the event titles in the source's list items. */
export const eventTitleSpans = (source: string): Span[] => {
  const items = itemsOf(source);
  const dated = items.filter((item) => DATED.test(item.content));
  return [...items.filter((item) => QUOTED_TITLE.test(item.content)), ...(dated.length >= DATED_ITEMS ? dated : [])].map(spanOf);
};
