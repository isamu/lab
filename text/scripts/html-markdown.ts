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
  const text = decodeEntities(stripTags(asLines(withoutNavigation(kept))));
  return tidyLines(
    text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "-"),
  );
};
