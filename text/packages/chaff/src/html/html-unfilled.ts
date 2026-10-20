// A block the page hides until a script fills it in: a "related pages" or recommendation box drawn as a heading over
// empty rows, shown only once its results arrive. Told by its markup, never by its words: the block is hidden by an
// inline style (display: none), and it either holds a script or nothing but headings. A hidden block with text of its
// own and no script (an accordion's body, an answer opened by a click) is the page's and stays. Read before scripts
// are dropped. Pure; a regular-expression reading.
import { ATTRIBUTES, hasNoWords, headingRanges, plainText, withoutElementsOpening, withoutRanges, type ElementRange } from "./html-elements.ts";

// The declaration ends at ";" or the attribute's quote, so "display:none-ish" is not it.
const DISPLAY_NONE = String.raw`(?<![\w-])display\s*:\s*none\s*(?:!\s*important\s*)?`;

const STYLE_NOT_DISPLAYED = String.raw`style\s*=\s*(?:"[^"]*${DISPLAY_NONE}(?:;[^"]*)?"|'[^']*${DISPLAY_NONE}(?:;[^']*)?')`;

const HIDDEN_BY_STYLE_OPENING = new RegExp(String.raw`<([a-z][a-z0-9-]*)${ATTRIBUTES}\s+${STYLE_NOT_DISPLAYED}`, "giu");

const HIDDEN_BY_STYLE = new RegExp(String.raw`^<[a-z][a-z0-9-]*${ATTRIBUTES}\s+${STYLE_NOT_DISPLAYED}`, "iu");

// A script of data (JSON-LD, a template) fills nothing in; one with no type, or a JavaScript type, does.
const RUNNING_SCRIPT = /<script\b(?![^>]*\stype\s*=\s*["']?(?!(?:text|application)\/(?:x-)?(?:java|ecma)script|module)[^"'\s>])[^>]*>/iu;

const holdsScript = (inner: string): boolean => RUNNING_SCRIPT.test(inner);

const holdsOnlyHeadings = (inner: string): boolean => {
  const headings = headingRanges(inner).toSorted((left, right) => left.start - right.start);
  return headings.length > 0 && hasNoWords(plainText(withoutRanges(inner, headings)));
};

const isUnfilledWidget = (range: ElementRange): boolean => HIDDEN_BY_STYLE.test(range.openTag) && (holdsScript(range.inner) || holdsOnlyHeadings(range.inner));

// A script's own text often writes markup as strings ('<div class="item">'), which would unbalance the blocks around
// it; the script is emptied first and still marks the block. The converter drops scripts afterwards anyway.
const SCRIPT = /<script\b([^>]*)>[\s\S]*?<\/script\s*>/giu;

const withScriptsEmptied = (html: string): string => html.replace(SCRIPT, "<script$1></script>");

export const withoutUnfilledWidgets = (html: string): string => withoutElementsOpening(withScriptsEmptied(html), HIDDEN_BY_STYLE_OPENING, isUnfilledWidget);
