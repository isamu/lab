import { escapeRegExp } from "./regexp.ts";

/**
 * sentence-splitter ends a sentence at the full stop of a label before its number: "FIG." and "1 illustrates …" were two
 * sentences, and so were "Vol." and "XLIII (1979)". Where a number follows, that full stop is replaced with a letter
 * before splitting. The length does not change, so the spans fit the original text.
 * A lone "I" after a label is the pronoun ("He said No. I left."), and a word ("the last Fig. The tree") is not a number.
 */

/** Built once from the lexicon; undefined when no label ends in a full stop. */
export type LabelStops = RegExp | undefined;

const NUMBER_AFTER = String.raw`(?=\s+(?:\d|(?:[IVXLCDM]{2,}|[VXLCDM])(?![\p{L}\p{N}_])))`;
const PLAIN_LETTER = "n";

/** The labels as written and in capitals, without their full stop ("Fig." → Fig, FIG). */
export const labelStops = (labels: readonly string[]): LabelStops => {
  const stems = labels.filter((label) => label.endsWith(".")).flatMap((label) => [label.slice(0, -1), label.slice(0, -1).toUpperCase()]);
  if (stems.length === 0) return undefined;
  return new RegExp(String.raw`(?<![\p{L}\p{N}_.])(?:${[...new Set(stems)].map(escapeRegExp).join("|")})\.${NUMBER_AFTER}`, "gu");
};

/** The text with the full stop of every label before a number replaced by a letter. */
export const unmarkLabelStops = (text: string, stops: LabelStops): string =>
  stops === undefined ? text : text.replace(stops, (label: string) => `${label.slice(0, -1)}${PLAIN_LETTER}`);
