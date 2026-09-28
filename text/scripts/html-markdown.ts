// An HTML page (a CRS report as EveryCRSReport serves it) as plain Markdown: headings, paragraphs, list items and the
// text of links. Scripts, styles, the head, navigation, tables, footnote marks and lists of in-page links (a table of
// contents) are dropped. Pure; a regular-expression reading that is enough for the documents in the corpus, not a
// parser for any HTML.
import { decodeEntities, tidyLines } from "./markup-text.ts";

const DROPPED = ["script", "style", "head", "nav", "noscript", "svg", "table"];

/** Apply step until the text stops changing: nested elements are removed from the inside out. */
const untilStable = (text: string, step: (text: string) => string): string => {
  const next = step(text);
  return next === text ? text : untilStable(next, step);
};

const withoutElement = (html: string, tag: string): string => {
  const innermost = new RegExp(`<${tag}\\b[^>]*>(?:(?!<${tag}\\b)[\\s\\S])*?</${tag}\\s*>`, "giu");
  return untilStable(html, (text) => text.replace(innermost, " "));
};

const stripTags = (html: string): string => html.replace(/<\/?[a-z!][^>]*>/giu, "");

const IN_PAGE_LINK = /<a\b[^>]*href="#[^"]*"[^>]*>[\s\S]*?<\/a\s*>/giu;

/** A list whose every item is only a link within the page, such as a table of contents. */
const isNavigation = (body: string): boolean => (body.match(IN_PAGE_LINK) ?? []).length > 0 && stripTags(body.replace(IN_PAGE_LINK, "")).trim() === "";

const withoutNavigation = (html: string): string =>
  html.replace(/<(ul|ol)\b[^>]*>((?:(?!<[uo]l\b)[\s\S])*?)<\/\1\s*>/giu, (whole: string, _tag: string, body: string) => (isNavigation(body) ? " " : whole));

// An in-page link is wrapped in these marks so that one standing alone on its line ("Jump to main text") can be told
// from one inside a sentence ("see Table 1"); the first is dropped, the second keeps its text.
const LINK_START = "\u0001";
const LINK_END = "\u0002";

const markInPageLinks = (html: string): string => html.replace(IN_PAGE_LINK, (link: string) => `${LINK_START}${stripTags(link)}${LINK_END}`);

const isLoneLink = (line: string): boolean => line.startsWith(LINK_START) && line.endsWith(LINK_END) && line.indexOf(LINK_START, 1) === -1;

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

export const htmlToMarkdown = (html: string): string => {
  const kept = DROPPED.reduce(withoutElement, html.replace(/<!--[\s\S]*?-->/gu, ""))
    .replace(/<sup\b[^>]*>\s*<a\b[^>]*>[^<]*<\/a\s*>\s*<\/sup\s*>/giu, "")
    .replace(/\s+/gu, " ");
  const text = decodeEntities(stripTags(asLines(markInPageLinks(withoutNavigation(kept)))));
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "-" && !isLoneLink(line))
    .map((line) => line.replaceAll(LINK_START, "").replaceAll(LINK_END, ""));
  return tidyLines(withoutEmptySections(lines));
};
