// Parts of a page that are controls rather than the document: a tooltip, a media player with its buttons, a block a
// script runs when clicked, a bar of previous and next links between arrows, and text marked never to be spoken.
// Each is told by its structure (a role, an <audio> or <video>, an event handler, the arrows), never by a site's class
// names. Also a box the page hides until a script fills it in (withoutUnfilledWidgets). Pure; a regular-expression
// reading.
import {
  ANY_LINK,
  ATTRIBUTES,
  elementRanges,
  fileExtension,
  hasNoWords,
  hasSentence,
  headingRanges,
  isFileLink,
  plainText,
  withoutElementsOpening,
  withoutRanges,
  type ElementRange,
} from "./html-elements.ts";

// The declaration ends at ";" or the attribute's quote, so "display:none-ish" is not it.
const DISPLAY_NONE = String.raw`(?<![\w-])display\s*:\s*none\s*(?:!\s*important\s*)?`;

const STYLE_NOT_DISPLAYED = String.raw`style\s*=\s*(?:"[^"]*${DISPLAY_NONE}(?:;[^"]*)?"|'[^']*${DISPLAY_NONE}(?:;[^']*)?')`;

const HIDDEN_BY_STYLE_OPENING = new RegExp(String.raw`<([a-z][a-z0-9-]*)${ATTRIBUTES}\s+${STYLE_NOT_DISPLAYED}`, "giu");

const HIDDEN_BY_STYLE = new RegExp(String.raw`^<[a-z][a-z0-9-]*${ATTRIBUTES}\s+${STYLE_NOT_DISPLAYED}`, "iu");

const SCRIPT_OPENING = /<script\b[^>]*>/giu;

const TYPE = /\stype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/iu;

// A script of data (JSON-LD, a template) fills nothing in; one with no type, a JavaScript type or a module does.
const RUNNING_TYPE = /^(?:(?:text|application)\/(?:x-)?(?:java|ecma)script|module)?$/iu;

const isRunning = (opening: string): boolean => {
  const type = TYPE.exec(opening);
  return RUNNING_TYPE.test((type?.[1] ?? type?.[2] ?? type?.[3] ?? "").trim());
};

const holdsRunningScript = (inner: string): boolean => (inner.match(SCRIPT_OPENING) ?? []).some(isRunning);

const holdsOnlyHeadings = (inner: string): boolean => {
  const headings = headingRanges(inner).toSorted((left, right) => left.start - right.start);
  return headings.length > 0 && hasNoWords(plainText(withoutRanges(inner, headings)));
};

const isUnfilledWidget = (range: ElementRange): boolean =>
  HIDDEN_BY_STYLE.test(range.openTag) && (holdsRunningScript(range.inner) || holdsOnlyHeadings(range.inner));

// A script's own text often writes markup as strings ('<div class="item">'), which would unbalance the blocks around
// it; the script is emptied first and still marks the block. The converter drops scripts afterwards anyway.
const SCRIPT = /<script\b([^>]*)>[\s\S]*?<\/script\s*>/giu;

const withScriptsEmptied = (html: string): string => html.replace(SCRIPT, "<script$1></script>");

/**
 * A box the page hides (an inline display: none) until a script fills it in, such as a "related pages" box drawn as a
 * heading over empty rows: it holds a running script, or nothing but headings. A hidden block with text of its own and
 * no running script (an accordion's body, an answer opened by a click) is the page's and stays. Read before scripts
 * are dropped.
 */
export const withoutUnfilledWidgets = (html: string): string => withoutElementsOpening(withScriptsEmptied(html), HIDDEN_BY_STYLE_OPENING, isUnfilledWidget);

/** Every element whose opening tag carries attribute (name and value as a pattern), matched to its own closing tag. */
const withoutElementsWithAttribute = (html: string, attribute: string): string => {
  const opening = new RegExp(String.raw`<([a-z][a-z0-9-]*)${ATTRIBUTES}\s+${attribute}`, "giu");
  const marked = new RegExp(String.raw`^<[a-z][a-z0-9-]*${ATTRIBUTES}\s+${attribute}`, "iu");
  return withoutElementsOpening(html, opening, (range) => marked.test(range.openTag));
};

// A role is a list of tokens and the first one counts, as for role="main".
const TOOLTIP_ROLE = String.raw`role\s*=\s*(?:"\s*tooltip(?:\s[^"]*)?"|'\s*tooltip(?:\s[^']*)?'|tooltip(?=[\s/>]))`;

// speak: none in a style says the text is not to be read out: data for scripts, such as an id beside a title.
const UNSPOKEN_STYLE = String.raw`style\s*=\s*(?:"[^"]*\bspeak\s*:\s*none\b[^"]*"|'[^']*\bspeak\s*:\s*none\b[^']*')`;

/** A tooltip ("The code has been copied to your clipboard.") shows beside a control, and unspoken text is not read. */
const withoutTooltipsAndUnspoken = (html: string): string => withoutElementsWithAttribute(withoutElementsWithAttribute(html, TOOLTIP_ROLE), UNSPOKEN_STYLE);

const MEDIA_ELEMENT = /<(audio|video)\b[^>]*>[\s\S]*?<\/\1\s*>/giu;

const PLAYER_BLOCKS = ["div", "section", "figure"];

// A caption is the document's even when it is not a sentence ("Interview with the mayor"), so its block is no player.
const holdsMedia = (range: ElementRange): boolean => /<(?:audio|video)\b/iu.test(range.inner) && !/<figcaption\b/iu.test(range.inner);

/** The text around the media, without the words a browser shows only when it cannot play it. */
const hasSentenceBesideMedia = (range: ElementRange): boolean => hasSentence(range.inner.replace(MEDIA_ELEMENT, " "));

const MEDIA_EXTENSION = /^(?:mp3|m4a|aac|wav|ogg|oga|opus|mp4|m4v|webm|mov)$/iu;

/** A link to a file other than the media itself (a transcript in PDF, an address) is the document's. */
const isDocumentFile = (link: string): boolean => isFileLink(link) && !MEDIA_EXTENSION.test(fileExtension(link) ?? "");

const isPlayer = (range: ElementRange): boolean =>
  holdsMedia(range) && !hasSentenceBesideMedia(range) && ![...range.inner.matchAll(ANY_LINK)].some((link) => isDocumentFile(link[0]));

/**
 * A block holding an <audio> or <video> and not a sentence is its player: the controls, the timer, "Embed", "share",
 * "Direct link" to the media's own file. The outermost such block goes; a block with a sentence, a caption or a link
 * to another file stays.
 */
const withoutMediaPlayers = (html: string): string => {
  const players = PLAYER_BLOCKS.flatMap((tag) => elementRanges(html, tag)).filter(isPlayer);
  return withoutRanges(
    html,
    players.toSorted((left, right) => left.start - right.start || right.end - left.end),
  );
};

const EVENT_HANDLER = String.raw`on[a-z]+\s*=`;

const CONTROL_OPENING = new RegExp(String.raw`<(div|p|span|li)${ATTRIBUTES}\s+${EVENT_HANDLER}`, "giu");

/** Links and nothing else, but no link that wraps blocks. */
const isOnlyPlainLinks = (inner: string): boolean => {
  const links = [...inner.matchAll(ANY_LINK)].map((link) => link[0]);
  return links.length > 0 && !links.some((link) => /<(?:div|p|h[1-6]|ul|ol)\b/iu.test(link)) && hasNoWords(plainText(inner.replace(ANY_LINK, " ")));
};

/**
 * A block that runs a script when clicked (onclick) and holds only a link ("Start Quiz") is a button drawn as a link.
 * A link with a handler of its own, inside a sentence, stays: it is only counted when followed.
 */
const isScriptedControl = (range: ElementRange): boolean =>
  new RegExp(String.raw`^<[a-z]+${ATTRIBUTES}\s+${EVENT_HANDLER}`, "iu").test(range.openTag) && isOnlyPlainLinks(range.inner);

const withoutScriptedControls = (html: string): string => withoutElementsOpening(html, CONTROL_OPENING, isScriptedControl);

const BACK_ARROW = "[←‹«◀◁]";
const FORWARD_ARROW = "[→›»▶▷]";
const PAGING_TEXT = new RegExp(`^${BACK_ARROW}.*${FORWARD_ARROW}$`, "u");
const MIN_PAGING_LINKS = 2;

const PAGING_BLOCKS = ["div", "section", "p", "td"];

/**
 * Opens with a back arrow and closes with a forward one around two or more links to pages (never a file), with no sentence beside them: "←
 * Previous | Title | Next →". Link text is not looked at, since a name's initial ("John P.") is not a sentence.
 */
const isPagingBar = (range: ElementRange): boolean => {
  const links = [...range.inner.matchAll(ANY_LINK)].map((link) => link[0]);
  return (
    PAGING_TEXT.test(plainText(range.inner)) && links.length >= MIN_PAGING_LINKS && !links.some(isFileLink) && !hasSentence(range.inner.replace(ANY_LINK, " "))
  );
};

/** The innermost blocks that are a bar of previous and next links, as a work's header draws them over each chapter. */
const withoutPagingBars = (html: string): string => {
  const bars = PAGING_BLOCKS.flatMap((tag) => elementRanges(html, tag)).filter(isPagingBar);
  const innermost = bars.filter((outer) => !bars.some((inner) => inner !== outer && outer.start <= inner.start && inner.end <= outer.end));
  return withoutRanges(
    html,
    innermost.toSorted((left, right) => left.start - right.start),
  );
};

/** Controls and their text: tooltips, unspoken data, media players, scripted link buttons and paging bars. */
export const withoutWidgets = (html: string): string => withoutPagingBars(withoutScriptedControls(withoutMediaPlayers(withoutTooltipsAndUnspoken(html))));
