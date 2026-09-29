// A <pre> block of an HTML page, which the converter otherwise reads as one run of prose: code (a <pre> holding one
// <code>, or one whose markup declares a language) becomes a fenced code block, and any other preformatted text (a
// poem, an address, a plain-text notice) keeps its lines, each one a paragraph. Each block is set aside before the
// page's whitespace is collapsed and put back once the page is lines. Pure.
import { asMarkup, plainText, stripTags } from "./html-elements.ts";
import { decodeEntities } from "./markup-text.ts";

type Preformatted = { readonly isCode: boolean; readonly lines: readonly string[] };

export type StashedPage = { readonly html: string; readonly blocks: readonly Preformatted[] };

const PLACE_START = "\u0005";
const PLACE_TEXT = "\u0006";

const PRE = /<pre\b([^>]*)>([\s\S]*?)<\/pre\s*>/giu;

const WRAPPER = /^<[a-z][a-z0-9-]*\b[^>]*>\s*$/iu;

// A highlighter names the language on the <pre> or on a wrapper or two around it (Sphinx: two <div>s); the bound
// keeps a long run of opening tags from being walked back for every <pre>.
const MAX_WRAPPERS = 4;

/** The opening tags right before end, with nothing but whitespace between them: the elements wrapping a <pre>. */
const wrappersBefore = (html: string, end: number, depth: number): string => {
  const open = html.lastIndexOf("<", end - 1);
  if (depth === 0 || open < 0 || !WRAPPER.test(html.slice(open, end))) return "";
  return `${wrappersBefore(html, open, depth - 1)}${html.slice(open, end)}`;
};

const SOLE_CODE = /^\s*<code\b[^>]*>[\s\S]*<\/code\s*>\s*$/iu;

const CLASS = /\sclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/iu;

const LANGUAGE_CLASS = /^(?:language|lang|highlight)-(.+)$/iu;

// The names highlighters give a block they leave unhighlighted: plain text, not code.
const PLAIN_LANGUAGES = new Set(["text", "txt", "plain", "plaintext", "none", "nohighlight"]);

const classTokens = (openTag: string): string[] => {
  const match = CLASS.exec(openTag);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").split(/\s+/u);
};

const declaresLanguage = (openTags: string): boolean =>
  openTags.split(">").some((tag) =>
    classTokens(tag).some((token) => {
      const language = LANGUAGE_CLASS.exec(token)?.[1];
      return language !== undefined && !PLAIN_LANGUAGES.has(language.toLowerCase());
    }),
  );

const isSoleCode = (inner: string): boolean => SOLE_CODE.test(inner) && (inner.match(/<code\b/giu) ?? []).length === 1;

/** The block's text as its lines, with the blank lines around them dropped. */
const textLinesOf = (inner: string): string[] => {
  const lines = decodeEntities(stripTags(inner.replace(/<br\s*\/?>/giu, "\n")))
    .split(/\r?\n/u)
    .map((line) => line.trimEnd());
  const first = lines.findIndex((line) => line !== "");
  return first === -1 ? [] : lines.slice(first, lines.findLastIndex((line) => line !== "") + 1);
};

const placeholder = (index: number, inner: string): string => `${PLACE_START}${String(index)}${PLACE_TEXT}${asMarkup(plainText(inner))}${PLACE_START}`;

/**
 * Every <pre> replaced by a placeholder holding its text on one line, as the page read before, so that what decides
 * about the blocks around it (a menu, a sentence, a heading's content) sees the same words.
 */
export const withPreformattedStashed = (html: string): StashedPage => {
  const found = [...html.matchAll(PRE)];
  const blocks = found.map((match) => {
    const [, attributes = "", inner = ""] = match;
    return { isCode: isSoleCode(inner) || declaresLanguage(`${wrappersBefore(html, match.index, MAX_WRAPPERS)}<pre${attributes}>`), lines: textLinesOf(inner) };
  });
  const indexAt = new Map(found.map((match, index) => [match.index, index]));
  const stashed = html.replace(
    PRE,
    (_whole: string, attributes: string, inner: string, at: number) => `<pre${attributes}>${placeholder(indexAt.get(at) ?? -1, inner)}</pre>`,
  );
  return { html: stashed, blocks };
};

const MIN_FENCE = 3;

/** A fence longer than any run of backticks in the code, so that none of them closes it. */
const fenceFor = (lines: readonly string[]): string => {
  const longest = Math.max(0, ...lines.flatMap((line) => (line.match(/`+/gu) ?? []).map((run) => run.length)));
  return "`".repeat(Math.max(MIN_FENCE, longest + 1));
};

const rendered = (block: Preformatted): string[] => {
  if (block.lines.length === 0) return [];
  if (!block.isCode) return [...block.lines.map((line) => line.trim()).flatMap((line) => (line === "" ? [] : ["", line])), ""];
  const fence = fenceFor(block.lines);
  return ["", fence, ...block.lines, fence, ""];
};

const PLACEHOLDER = new RegExp(`${PLACE_START}(\\d+)${PLACE_TEXT}([^${PLACE_START}]*)${PLACE_START}`, "gu");

const WHOLE_PLACEHOLDER = new RegExp(`^${PLACEHOLDER.source}$`, "u");

/** Each line that is a placeholder as its block; a placeholder inside a longer line (a heading) as its text on that line. */
export const withPreformattedRestored = (lines: readonly string[], blocks: readonly Preformatted[]): string[] =>
  lines.flatMap((line) => {
    const whole = WHOLE_PLACEHOLDER.exec(line);
    const block = whole === null ? undefined : blocks[Number(whole[1])];
    return block === undefined ? [line.replace(PLACEHOLDER, (_placeholder: string, _index: string, text: string) => text)] : rendered(block);
  });
