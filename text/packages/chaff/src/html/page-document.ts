// A fetched page as a document chaff reads: HTML turned into Markdown (headings become addresses), Markdown and plain
// text as they are. Anything else (a PDF, JSON, an image) is not text a quotation can be found in. Pure.
import { htmlToMarkdown } from "./html-markdown.ts";

/** The document a page reads as: the name that says how to read it (.md or .txt), and its text. */
export type PageDocument = { readonly path: string; readonly text: string } | { readonly unsupported: string };

const mediaTypeOf = (contentType: string | null): string => (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";

/** A body sent with no Content-Type is HTML when it opens like markup. */
const LOOKS_LIKE_HTML = /^\s*(?:<!doctype html|<html[\s>]|<head[\s>]|<body[\s>])/iu;

const HTML_TYPES: ReadonlySet<string> = new Set(["text/html", "application/xhtml+xml"]);
const MARKDOWN_TYPES: ReadonlySet<string> = new Set(["text/markdown", "text/x-markdown"]);

export const pageDocument = (contentType: string | null, body: string): PageDocument => {
  const type = mediaTypeOf(contentType);
  if (HTML_TYPES.has(type) || (type === "" && LOOKS_LIKE_HTML.test(body))) return { path: "page.md", text: htmlToMarkdown(body) };
  if (MARKDOWN_TYPES.has(type)) return { path: "page.md", text: body };
  if (type === "" || type.startsWith("text/")) return { path: "page.txt", text: body };
  return { unsupported: type };
};
