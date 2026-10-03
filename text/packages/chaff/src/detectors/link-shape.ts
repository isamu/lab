import type { Detector, Finding, Markup, ProseDocument, Span } from "../plugin.ts";
import { findingAt, markupOf, quoteOf } from "./markup-finding.ts";
import { linkTextOf } from "../link-text.ts";
import { bareUrls } from "../bare-url.ts";
import { isFileNameAlt, isUrlText, mismatchedHost } from "../link-shape.ts";
import { minorityWithin } from "../orthography.ts";
import { readMarkdown, spansOfType } from "../markdown-read.ts";

/** A bare URL is reported only while bare URLs are at most this share of the document's links; past it, bare is a style. */
const BARE_SHARE_PERCENT = 25;

/** The link text, or undefined for an autolink, a definition or a link whose text is itself an address. */
const wordedText = (source: string, link: Span): string | undefined => {
  const text = linkTextOf(source.slice(link.start, link.end));
  return text === undefined || text.trim() === "" || isUrlText(text) ? undefined : text;
};

/** An inline link the reader clicks on words (`[text](url)`). A reference definition's span does not show the words used with it, so it is not counted. */
const isWorded = (source: string, link: Span): boolean => wordedText(source, link) !== undefined;

/** A link destination the parser gave up on (`[a](https://…/{{ page }})`, a space in it): what is left is a link, not a bare URL. */
const FAILED_DESTINATION = "](";

const inside = (span: Span, regions: readonly Span[]): boolean => regions.some((region) => span.start >= region.start && span.start < region.end);

/**
 * The bare URLs the reader sees as text (outside links, code and quotations). A URL in a table cell is a value the table lists
 * (an example request, a field's content), not a link the prose points to, so tables are left out.
 */
const bareUrlSpans = (source: string, markup: Markup): Span[] => {
  const tables = spansOfType(readMarkdown(source).root, "table");
  return markup.texts.flatMap((text) =>
    bareUrls(source.slice(text.start, text.end))
      .map((url) => ({ start: text.start + url.start, end: text.start + url.end }))
      .filter((url) => !source.startsWith(FAILED_DESTINATION, url.start - FAILED_DESTINATION.length) && !inside(url, tables)),
  );
};

type Address = Span & { readonly bare: boolean };

/**
 * A URL written bare (`https://…`) in a document whose other links are words (`[the guide](https://…)`). Reported only when the
 * document has at least `limit` worded links and the bare ones are the few; a document that writes its URLs bare throughout is not.
 */
export const bareUrlMix: Detector = (doc: ProseDocument, options): Finding[] => {
  const markup = markupOf(doc);
  if (markup === undefined) return [];
  const worded: Address[] = markup.links.filter((link) => isWorded(doc.source, link)).map((link) => ({ ...link, bare: false }));
  if (worded.length < options.limit) return [];
  const bare: Address[] = bareUrlSpans(doc.source, markup).map((url) => ({ ...url, bare: true }));
  return minorityWithin([...worded, ...bare], (address) => address.bare, BARE_SHARE_PERCENT)
    .filter((address) => address.bare)
    .map((address) => findingAt(doc, address, { url: quoteOf(doc.source, address), count: worded.length }));
};

/** A link whose text is an address on one host and whose destination is on another (`[https://a.example](https://b.example)`). */
export const linkTextUrlMismatch: Detector = (doc): Finding[] =>
  (markupOf(doc)?.links ?? []).flatMap((link) => {
    const text = linkTextOf(doc.source.slice(link.start, link.end));
    const hosts = text === undefined ? undefined : mismatchedHost(text, link.destination);
    return hosts === undefined ? [] : [findingAt(doc, link, hosts)];
  });

/** An image whose alt text is its file's name (`IMG_1234.png`, `Screenshot 2026-04-01`). The name prefixes come from the lexicon. */
export const imageFileNameAlt: Detector = (doc, options): Finding[] => {
  const prefixes = (options.lexicon ?? []).map((entry) => entry.pattern);
  return (markupOf(doc)?.images ?? []).flatMap((image) =>
    image.alt !== undefined && isFileNameAlt(image.alt, prefixes) ? [findingAt(doc, image, { alt: image.alt.trim() })] : [],
  );
};
