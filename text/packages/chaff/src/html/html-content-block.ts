// The content of a page that marks none (no <main>, no role="main", no sole <article>): the innermost block that
// holds every heading (the <h1> title among them) and nearly all the text written in sentences. A site's menus, side columns and footer are
// labels and links, not sentences, so they fall outside; when the sentences are spread over blocks, no block
// qualifies and the whole page is read. Pure; a regular-expression reading.
import { CLOSED_SENTENCE, elementRanges, plainText, type ElementRange } from "./html-elements.ts";
import { decodeEntities } from "./markup-text.ts";

const TAG = /<\/?[a-z!][^>]*>/giu;

// Tags that end a line of text; inline tags (a link, a span, a <br> inside a paragraph) run on inside a sentence.
const LINE_BREAK = /^<\/?(?:p|div|li|dd|dt|td|th|h[1-6]|section|article|header|blockquote|ul|ol|dl|table|tr)\b/iu;

const SENTENCE_END = new RegExp(CLOSED_SENTENCE.source, "gu");

type Sentence = { readonly at: number; readonly text: string };

type Scan = { readonly start: number; readonly line: string; readonly found: Sentence[] };

/** A text between tags: each sentence closed in it is found with the text before it on its line; the rest runs on. */
const scanText = (scan: Scan, text: string, at: number): Scan => {
  const start = scan.line === "" ? at : scan.start;
  const ends = [...text.matchAll(SENTENCE_END)].map((end) => end.index + end[0].length);
  if (ends.length === 0) return { start, line: scan.line + text, found: scan.found };
  ends.forEach((end, index) => scan.found.push({ at: start, text: (index === 0 ? scan.line : "") + text.slice(ends[index - 1] ?? 0, end) }));
  return { start: at, line: text.slice(ends.at(-1) ?? text.length), found: scan.found };
};

type TagScan = Scan & { readonly from: number };

/** The text before a tag, then the tag: a line break starts a new line. */
const scanTag = (html: string, scan: TagScan, tag: RegExpExecArray): TagScan => {
  const before = html.slice(scan.from, tag.index);
  const scanned = before === "" ? scan : scanText(scan, decodeEntities(before), scan.from);
  const next = LINE_BREAK.test(tag[0]) ? { start: tag.index, line: "", found: scanned.found } : scanned;
  return { ...next, from: tag.index + tag[0].length };
};

/** Each sentence on the page with the words before it on its line, and where that line starts; in document order. */
const sentences = (html: string): Sentence[] => {
  const scan = [...html.matchAll(TAG)].reduce<TagScan>((state, tag) => scanTag(html, state, tag), { start: 0, line: "", found: [], from: 0 });
  const rest = html.slice(scan.from);
  return (rest === "" ? scan : scanText(scan, decodeEntities(rest), scan.from)).found;
};

const TITLE = /<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/giu;

type Weighed = { readonly at: number; readonly weight: number };

/**
 * How much text each sentence carries: its length, or nothing when it only repeats the page's title (a question set as
 * the title and again in a breadcrumb), so that a short page's title does not outweigh its body.
 */
const weighed = (html: string): Weighed[] => {
  const titles = new Set([...html.matchAll(TITLE)].map((title) => plainText(title[1] ?? "")));
  return sentences(html).map((sentence) => {
    const text = sentence.text.replace(/\s+/gu, " ").trim();
    return { at: sentence.at, weight: titles.has(text) ? 0 : text.length };
  });
};

/** The total weight of the sentences whose line starts in [start, end), from running totals (totals[i] = before i). */
const weightWithin = (all: readonly Weighed[], totals: readonly number[], start: number, end: number): number => {
  const firstAtOrAfter = (at: number, low = 0, high = all.length): number => {
    if (low >= high) return low;
    const middle = Math.floor((low + high) / 2);
    return (all[middle]?.at ?? 0) < at ? firstAtOrAfter(at, middle + 1, high) : firstAtOrAfter(at, low, middle);
  };
  return (totals[firstAtOrAfter(end)] ?? 0) - (totals[firstAtOrAfter(start)] ?? 0);
};

const runningTotals = (all: readonly Weighed[]): number[] =>
  all.reduce<number[]>(
    (sums, sentence) => {
      sums.push((sums.at(-1) ?? 0) + sentence.weight);
      return sums;
    },
    [0],
  );

// Share of the page's sentence text the block must hold: a line in the footer may fall outside it, a section of the
// document may not.
const CONTENT_SHARE = 0.9;

const CONTENT_BLOCKS = ["div", "section"];

/**
 * The inside of the content block, or undefined when the page has no sentence, no block to single out, or no <h1>:
 * without a marked title, a title set in a plain block (and its byline) could fall outside.
 */
export const contentBlock = (html: string): string | undefined => {
  if (!/<h1\b/iu.test(html)) return undefined;
  const headings = [...html.matchAll(/<h[1-6]\b/giu)].map((heading) => heading.index);
  const all = weighed(html);
  const totals = runningTotals(all);
  const whole = totals.at(-1) ?? 0;
  if (whole === 0) return undefined;
  // Every heading is the document's (a list under "Members" has no sentence), and nothing written in sentences may
  // stand before the block ("Updated." above the title): only a footer's line after it.
  const holdsContent = (range: ElementRange): boolean =>
    headings.every((heading) => heading > range.start && heading < range.end) &&
    weightWithin(all, totals, 0, range.start) === 0 &&
    weightWithin(all, totals, range.start, range.end) >= whole * CONTENT_SHARE;
  const smallest = CONTENT_BLOCKS.flatMap((tag) => elementRanges(html, tag))
    .filter(holdsContent)
    .toSorted((left, right) => left.end - left.start - (right.end - right.start))[0];
  return smallest?.inner;
};
