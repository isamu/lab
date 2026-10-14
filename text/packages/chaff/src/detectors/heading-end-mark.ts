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

const LOWER_CASE = /\p{Ll}/u;
/** A word of this many capitals is a word set in capitals, not only an acronym (AGENCY, DATES; not FAQ). */
const CAPITALS_WORD = /\p{Lu}{4,}/u;

/**
 * Whether a heading is set in capitals ("AGENCY:", "FOR FURTHER INFORMATION CONTACT:"). A notice's captions are one kind of
 * heading and its sections in ordinary case ("Footnotes") another, so the two are compared apart.
 */
export const isCapitalsHeading = (heading: string): boolean => !LOWER_CASE.test(heading) && CAPITALS_WORD.test(heading);

/** Headings compared with one another: the same depth, and the same case (capitals or ordinary). */
const kindOf = (entry: Judged): string => `${String(entry.heading.depth)}:${String(isCapitalsHeading(entry.heading.text))}`;

/** The odd ones among headings of one kind, each with the usual side's first heading and count. */
const oddOfKind = (doc: ProseDocument, judged: readonly Judged[]): Finding[] => {
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
 * Headings that end with a colon or a full stop where most headings of the same depth and case do not, or the other way round.
 * Headings of one depth are one kind of heading; a depth of labels ("Optional:") is its own way, and so are captions set in
 * capitals. The page title (one top-level heading that opens the document) is a name and is not compared.
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
  const kinds = [...new Set(judged.map(kindOf))];
  return kinds
    .flatMap((kind) =>
      oddOfKind(
        doc,
        judged.filter((entry) => kindOf(entry) === kind),
      ),
    )
    .toSorted((left, right) => Number(left.values["offset"]) - Number(right.values["offset"]));
};
