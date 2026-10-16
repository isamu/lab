// number-without-unit, in prose: a number written with a word of scale and no unit (83,494百万, 83 million) where the
// document writes that word of scale with one unit many times and without one nowhere else (83,494百万円, $83 million).
// Pure; the words of scale, the currency marks and the joiners come from the language's lexicons.
import { escapeRegExp } from "../orthography.ts";
import type { CurrencyForm } from "./currency-notation.ts";
import { AMOUNT } from "./currency-notation.ts";

/** A number with a word of scale: from its currency mark (if any) to the end of its unit, and the unit ("" when bare). */
export type ScaledFigure = { readonly offset: number; readonly end: number; readonly written: string; readonly scale: string; readonly unit: string };

export type ScaleWords = { readonly scales: readonly string[]; readonly forms: readonly CurrencyForm[]; readonly joiners: readonly string[] };

export type ScaleGap = { readonly figure: ScaledFigure; readonly unit: string };

/** How many numbers must carry the unit before the one without it reads as a slip rather than a way of writing. */
export const MIN_WITH_UNIT = 5;

const LATIN = /[A-Za-z]/u;
const longestFirst = (words: readonly string[]): string[] => words.toSorted((left, right) => right.length - left.length);

const figurePattern = (scales: readonly string[]): RegExp => {
  const scale = longestFirst(scales)
    .map((word) => `${escapeRegExp(word)}${LATIN.test(word) ? "(?![A-Za-z])" : ""}`)
    .join("|");
  return new RegExp(`(?<![\\w.,，．０-９])${AMOUNT}\\s?(?:${scale})`, "gu");
};

const formMatches = (text: string, pattern: string, side: "before" | "after"): boolean => {
  if (side === "before") return text.endsWith(pattern) && !(LATIN.test(pattern.charAt(0)) && LATIN.test(text.charAt(text.length - pattern.length - 1)));
  return text.startsWith(pattern) && !(LATIN.test(pattern.at(-1) ?? "") && LATIN.test(text.charAt(pattern.length)));
};

/** The currency mark written before a number ($, US$, ¥), with the one space it may have. */
const markBefore = (text: string, offset: number, forms: readonly CurrencyForm[]): string => {
  const before = text.slice(Math.max(0, offset - 8), offset);
  const spaced = before.endsWith(" ") ? before.slice(0, -1) : before;
  const form = longestFirst(forms.filter((entry) => entry.position === "before").map((entry) => entry.pattern)).find((pattern) =>
    formMatches(spaced, pattern, "before"),
  );
  if (form === undefined) return "";
  return spaced === before ? form : `${form} `;
};

/** What follows a word of scale as its unit: a currency word (円, dollars), else the next word ("people", 人, ドル); "" when none. */
const unitAfter = (rest: string, forms: readonly CurrencyForm[]): string => {
  const spaced = rest.startsWith(" ") ? rest.slice(1) : rest;
  const form = longestFirst(forms.filter((entry) => entry.position === "after").map((entry) => entry.pattern)).find((pattern) =>
    formMatches(spaced, pattern, "after"),
  );
  const word = form ?? /^(?:[A-Za-z]+|[\p{Script=Katakana}ー]+|\p{Script=Han})/u.exec(spaced)?.[0];
  if (word === undefined) return "";
  return spaced === rest ? word : ` ${word}`;
};

const figureAt = (text: string, match: RegExpExecArray, words: ScaleWords): ScaledFigure | undefined => {
  const end = match.index + match[0].length;
  const rest = text.slice(end);
  if (/^\s?[0-9０-９]/u.test(rest)) return undefined;
  const mark = markBefore(text, match.index, words.forms);
  const after = mark === "" ? unitAfter(rest, words.forms) : "";
  const scale = longestFirst(words.scales).find((word) => match[0].endsWith(word)) ?? "";
  return { offset: match.index - mark.length, end: end + after.length, written: match[0], scale, unit: (mark || after).trim() };
};

/** Every number with a word of scale in a text, in order; one that runs on into another number (1億2,000万円) is left out. */
export const scaledFiguresIn = (text: string, words: ScaleWords): ScaledFigure[] =>
  words.scales.length === 0 ? [] : [...text.matchAll(figurePattern(words.scales))].flatMap((match) => figureAt(text, match, words) ?? []);

/** A bare number joined to its neighbour by a range or list word, so that one unit serves both (100百万〜200百万円). */
const sharesUnit = (text: string, left: ScaledFigure | undefined, right: ScaledFigure | undefined, joiners: readonly string[]): boolean => {
  if (left === undefined || right === undefined) return false;
  const gap = text.slice(left.end, right.offset).trim();
  return gap === "" || joiners.includes(gap) || joiners.includes(gap.toLowerCase());
};

const gapOfScale = (text: string, figures: readonly ScaledFigure[], joiners: readonly string[]): ScaleGap[] => {
  const bare = figures.filter(
    (figure, index) => figure.unit === "" && !sharesUnit(text, figure, figures[index + 1], joiners) && !sharesUnit(text, figures[index - 1], figure, joiners),
  );
  const withUnit = figures.filter((figure) => figure.unit !== "");
  const units = new Set(withUnit.map((figure) => figure.unit));
  const [unit] = units;
  const [figure] = bare;
  if (figure === undefined || unit === undefined || bare.length !== 1 || units.size !== 1 || withUnit.length < MIN_WITH_UNIT) return [];
  return [{ figure, unit }];
};

/**
 * The one bare number of a word of scale whose other numbers all carry one unit, at least MIN_WITH_UNIT times. Two bare
 * numbers, or two units (百万円 and 百万株), and the document is read as writing the word that way on purpose.
 */
export const scaleGaps = (text: string, figures: readonly ScaledFigure[], joiners: readonly string[]): ScaleGap[] => {
  const scales = [...new Set(figures.map((figure) => figure.scale))];
  return scales
    .flatMap((scale) =>
      gapOfScale(
        text,
        figures.filter((figure) => figure.scale === scale),
        joiners,
      ),
    )
    .toSorted((left, right) => left.figure.offset - right.figure.offset);
};
