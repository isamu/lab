// Whether a sentence names where its content lives: a link, a web address, or a file in code. Pure.
import { bareUrls } from "../bare-url.ts";
import type { Span } from "../plugin.ts";

/** A code span: a run of backticks, then the same run closing it, neither run touching another backtick. */
const CODE_SPAN = /(?<!`)(`+)(?!`)(.+?)(?<!`)\1(?!`)/gsu;

/** A link to a place on the same page (`[text](#id)`): the reader is already on that page. */
const IN_PAGE_LINK = /\]\(\s*<?#[^)]*\)$/u;

/** A page a reader opens, as a file name: README.md, guide.html, spec.pdf. A source file (main.go) names code, not a page. */
const PAGE_FILE = /\.(?:md|markdown|mdx|txt|rst|adoc|html?|pdf)$/iu;

const SEPARATOR = /[/\\]/u;
const LETTER = /\p{L}/u;

/** Code that is a path (docs/api.md, ./config, src\index) or a page file, not an identifier or an expression. */
const isLocationCode = (code: string): boolean => {
  const written = code.trim();
  if (written.length === 0 || /\s/u.test(written) || !LETTER.test(written)) return false;
  return SEPARATOR.test(written) || PAGE_FILE.test(written);
};

/** The sentence as written names a web address or, in code, a path or a page file. */
export const namesLocation = (written: string): boolean =>
  bareUrls(written).length > 0 || [...written.matchAll(CODE_SPAN)].some((match) => isLocationCode(match[2] ?? ""));

/** One of the links written in the sentence's span leads off the page. */
export const holdsLink = (source: string, sentence: Span, links: readonly Span[]): boolean =>
  links.some((link) => link.start < sentence.end && link.end > sentence.start && !IN_PAGE_LINK.test(source.slice(link.start, link.end)));
