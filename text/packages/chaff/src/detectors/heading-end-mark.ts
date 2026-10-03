import type { Detector, Finding, MarkupHeading, ProseDocument } from "../plugin.ts";
import { findingAt, writtenHeadings } from "./markup-finding.ts";
import { pageTitleOf } from "./heading-case.ts";
import { minorityWithin } from "../orthography.ts";

/** A mark a heading may end with or go without: a colon or a full stop, in either width. A question mark belongs to the words. */
const END_MARK = /[:：.。]$/u;

/** An ellipsis: the full stops are the words trailing off. */
const ELLIPSIS = /(?:\.\.\.|…)$/u;

/** Emphasis closed at the very end (`## **Note:**`): the mark the reader sees is the one before it. */
const EMPHASIS_MARKS = new Set(["*", "_"]);

const withoutClosingEmphasis = (text: string): string => {
  const kept = [...text];
  while (EMPHASIS_MARKS.has(kept.at(-1) ?? "")) kept.pop();
  return kept.join("");
};

const LETTER = /\p{L}/u;

/** Past this share, both ways are in use on purpose, and neither is the odd one. */
const MINORITY_PERCENT = 25;

/** Fewer section headings than this, and the majority is not yet a habit. */
const MIN_HEADINGS = 4;

/** Whether the heading's last word is one that ends in a full stop of its own (etc., Inc., from the lexicon). */
const endsWithWord = (shown: string, words: readonly string[]): boolean =>
  words.some((word) => shown.endsWith(word) && !LETTER.test(shown.charAt(shown.length - word.length - 1)));

/** The mark a heading ends with, "" for none, or undefined when its last full stop belongs to its words. */
export const endMarkOf = (heading: string, words: readonly string[] = []): string | undefined => {
  const shown = withoutClosingEmphasis(heading.trim()).trimEnd();
  if (ELLIPSIS.test(shown) || endsWithWord(shown, words)) return undefined;
  return END_MARK.exec(shown)?.[0] ?? "";
};

type Judged = { readonly heading: MarkupHeading; readonly mark: string };

/** The odd ones among headings of one depth, each with the usual side's first heading and count. */
const oddAtDepth = (doc: ProseDocument, judged: readonly Judged[]): Finding[] => {
  if (judged.length < MIN_HEADINGS) return [];
  const odd = minorityWithin(judged, (entry) => entry.mark !== "", MINORITY_PERCENT);
  const usual = judged.filter((entry) => !odd.includes(entry));
  const example = usual[0]?.heading.text.trim() ?? "";
  return odd.map((entry) =>
    findingAt(
      doc,
      entry.heading,
      { heading: entry.heading.text.trim(), mark: entry.mark, example, count: usual.length },
      entry.mark === "" ? "bare" : "marked",
    ),
  );
};

/**
 * Headings that end with a colon or a full stop where most headings of the same depth do not, or the other way round. Headings
 * of one depth are one kind of heading; a depth of labels ("Optional:") is its own way. The page title (one top-level heading
 * that opens the document) is a name and is not compared.
 */
export const headingEndMark: Detector = (doc, options): Finding[] => {
  const words = (options.lexicon ?? []).map((entry) => entry.pattern);
  const headings = writtenHeadings(doc);
  const title = pageTitleOf(headings);
  const judged = headings
    .filter((heading) => heading !== title)
    .flatMap((heading): Judged[] => {
      const mark = endMarkOf(heading.text, words);
      return mark === undefined ? [] : [{ heading, mark }];
    });
  const depths = [...new Set(judged.map((entry) => entry.heading.depth))];
  return depths
    .flatMap((depth) =>
      oddAtDepth(
        doc,
        judged.filter((entry) => entry.heading.depth === depth),
      ),
    )
    .toSorted((left, right) => Number(left.values["offset"]) - Number(right.values["offset"]));
};
