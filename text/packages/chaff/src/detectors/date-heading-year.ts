// The year a section's heading gives the dates under it: "FY27-Q2 (May 1)", 「2026年度の予定」, 「令和8年の行事」. A yearless
// date in such a section has its year. Pure.
import type { StructureNode } from "../plugin.ts";

/** A fiscal-year name with its year as a number: "FY{y}" of the language's reporting-period-frame lexicon. */
export type YearLabel = { readonly before: string; readonly after: string };

/** The words that name a year in a heading: era names (令和) and fiscal-year labels ("FY{y}"). */
export type HeadingYearWords = { readonly eras: readonly string[]; readonly labels: readonly YearLabel[] };

/** A year written as figures: 2024年度, "2024 events". */
const YEAR_FIGURES = /(?<![0-9０-９])(?:1[89]|20)\d{2}(?![0-9０-９])/u;
/** An era's year after its name: 8年 of 令和8年, 元年 of 令和元年度 (not 8月). */
const ERA_YEAR_NUMBER = /^[ \t]?(?:[0-9０-９]{1,2}|元)[ \t]?年/u;
/** A fiscal year's number: two figures (FY27) or four (FY2027). */
const LABEL_YEAR = /^(?:\d{2}|\d{4})(?!\d)/u;
const LETTER = /\p{L}/u;

/** "FY{y}" as the lexicon writes it: the words before and after the year. A name with no {y} names no year. */
export const yearLabelOf = (pattern: string): YearLabel | undefined => {
  const at = pattern.indexOf("{y}");
  return at === -1 || pattern.includes("{", at + 1) ? undefined : { before: pattern.slice(0, at).toLowerCase(), after: pattern.slice(at + 3).toLowerCase() };
};

const startsAt = (text: string, index: number): boolean => index === 0 || !LETTER.test(text.charAt(index - 1));

const indicesOf = (text: string, word: string, from = 0): number[] => {
  const at = word === "" ? -1 : text.indexOf(word, from);
  return at === -1 ? [] : [at, ...indicesOf(text, word, at + 1)];
};

const namesLabelYear = (heading: string, label: YearLabel): boolean => {
  const text = heading.toLowerCase();
  return indicesOf(text, label.before).some((at) => {
    if (!startsAt(text, at)) return false;
    const year = LABEL_YEAR.exec(text.slice(at + label.before.length))?.[0];
    return year !== undefined && text.startsWith(label.after, at + label.before.length + year.length);
  });
};

const namesEraYear = (heading: string, era: string): boolean => indicesOf(heading, era).some((at) => ERA_YEAR_NUMBER.test(heading.slice(at + era.length)));

/** The heading names a year: figures (2026年度), an era's year (令和8年), or a fiscal year (FY27). */
export const headingNamesYear = (heading: string, words: HeadingYearWords): boolean =>
  YEAR_FIGURES.test(heading) || words.eras.some((era) => namesEraYear(heading, era)) || words.labels.some((label) => namesLabelYear(heading, label));

const sectionHeading = (node: StructureNode, current: string): string =>
  node.kind === "section" && node.attrs["heading"] !== undefined ? String(node.attrs["heading"]) : current;

/** The offsets of the dates whose own section, the innermost one they are in, has a heading that names a year. */
export const datesUnderYearHeadings = (tree: StructureNode, words: HeadingYearWords, heading = ""): number[] => {
  const own = sectionHeading(tree, heading);
  if (tree.kind === "date") return headingNamesYear(own, words) ? [tree.span.start] : [];
  return tree.children.flatMap((child) => datesUnderYearHeadings(child, words, own));
};
