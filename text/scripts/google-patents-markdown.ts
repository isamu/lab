// A patent page as Google Patents serves it (patents.google.com/patent/<number>/<language>) as plain Markdown: only
// the patent's own text — the abstract, the description and the claims, each marked <section itemprop="…"> — is
// kept; the page's metadata, citations, family and similar-document tables are Google's and are dropped. A
// <heading> in the description (the patent office's section title, BACKGROUND OF THE INVENTION) becomes a heading.
// Pure.
import { htmlToMarkdown } from "../packages/chaff/src/html/html-markdown.ts";

const PATENT_SECTIONS = ["abstract", "description", "claims"] as const;

const SECTION_TAG = /<(\/?)section\b[^>]*>/giu;

/** The index just past the </section> that closes a section opened before `from`, or -1 when it never closes. */
const sectionEnd = (html: string, from: number): number => {
  const tags = [...html.slice(from).matchAll(SECTION_TAG)];
  const closing = tags.reduce<{ readonly depth: number; readonly end: number }>(
    (state, tag) => {
      if (state.end !== -1) return state;
      const depth = state.depth + (tag[1] === "/" ? -1 : 1);
      return { depth, end: depth === 0 ? from + tag.index + tag[0].length : -1 };
    },
    { depth: 1, end: -1 },
  );
  return closing.end;
};

/** The whole <section itemprop="name">…</section>, nested sections included, or "" when the page has none. */
const patentSection = (html: string, name: string): string => {
  const opening = new RegExp(`<section\\b[^>]*\\bitemprop\\s*=\\s*["']${name}["'][^>]*>`, "iu").exec(html);
  if (opening === null) return "";
  const end = sectionEnd(html, opening.index + opening[0].length);
  return end === -1 ? "" : html.slice(opening.index, end);
};

const withHeadings = (html: string): string => html.replace(/<heading\b[^>]*>([\s\S]*?)<\/heading\s*>/giu, "<h3>$1</h3>");

export const googlePatentsToMarkdown = (html: string): string => {
  const sections = PATENT_SECTIONS.map((name) => patentSection(html, name)).filter((section) => section !== "");
  // 特許の本文が一つも無いページ（番号違い・仕様変更）を、指摘ゼロの文書として黙って置かない。
  if (sections.length === 0) throw new Error("no abstract, description or claims section: not a Google Patents patent page");
  return htmlToMarkdown(`<main>${withHeadings(sections.join("\n"))}</main>`);
};
