// One paper citing in two styles ([3] here, (Smith, 2020) there, 〔3〕 or 3) elsewhere): the minority is reported. Pure.
// A Markdown footnote counts as a citation only when its note carries a year, so a footnote that remarks is not a style.
import { citationMarks, citationWordsOf, referenceListsOf, type CitationMark, type CitationStyle } from "./citation-marks.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding } from "../plugin.ts";

const FOOTNOTE_NOTE = /^\[\^([^\]\s]{1,20})\]:(.*)$/gmu;
const YEAR = /(?<!\d)(?:1[89]|20)\d{2}(?!\d)/u;

/** The footnote labels whose note reads as a reference: it gives a year. */
export const citingFootnotes = (text: string): ReadonlySet<string> =>
  new Set([...text.matchAll(FOOTNOTE_NOTE)].filter((match) => YEAR.test(match[2] ?? "")).map((match) => `[^${match[1] ?? ""}]`));

type StyleCount = { readonly style: CitationStyle; readonly marks: readonly CitationMark[] };

/** The styles in use, the most used first; a tie goes to the style used first. */
const stylesOf = (marks: readonly CitationMark[]): StyleCount[] => {
  const styles = [...new Set(marks.map((mark) => mark.style))];
  return styles
    .map((style) => ({ style, marks: marks.filter((mark) => mark.style === style) }))
    .toSorted((left, right) => right.marks.length - left.marks.length);
};

/** The citations in a minority style: a style other than the most used one, used at most limit times while the most used is used more. */
export const minorityCitations = (marks: readonly CitationMark[], limit: number): { readonly mark: CitationMark; readonly majority: StyleCount }[] => {
  const [majority, ...others] = stylesOf(marks);
  if (majority === undefined) return [];
  return others
    .filter((other) => other.marks.length <= limit && other.marks.length < majority.marks.length)
    .flatMap((other) => other.marks.map((mark) => ({ mark, majority })));
};

export const citationStyle: Detector = (doc, options): Finding[] => {
  const words = citationWordsOf(doc);
  const text = doc.prose ?? doc.source;
  const footnotes = citingFootnotes(doc.source);
  const marks = citationMarks(text, referenceListsOf(doc, words), words).filter((mark) => mark.style !== "footnote" || footnotes.has(mark.written));
  return minorityCitations(marks, options.limit).map(({ mark, majority }) => ({
    rule: "citation-style-mix",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, mark.start),
    values: { citation: mark.written, majority: majority.marks[0]?.written ?? "", count: majority.marks.length, offset: mark.start },
  }));
};
