import type { StructureNode } from "../plugin.ts";

// A model contract offers a clause to choose instead of another under the same number (第4条（変更オプション条項）
// after 第4条), and leaves a clause to add unnumbered (第●条). Neither is a slip in the numbering. Pure.

const lineStartAt = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

/** The last line with text before the line at offset; read backwards, so a long statute is not sliced per article. */
const previousLineOf = (source: string, offset: number): string => {
  let end = lineStartAt(source, offset) - 1;
  while (end > 0) {
    const start = lineStartAt(source, end);
    const line = source.slice(start, end);
    if (line.trim() !== "") return line;
    end = start - 1;
  }
  return "";
};

/** A line set apart as a label: in brackets (【…】, [ … ]) or a Markdown heading. A sentence that mentions the word is not one. */
const isLabelLine = (line: string): boolean => {
  const text = line.trim();
  return text.startsWith("#") || ("【〔［[（(".includes(text.charAt(0)) && "】〕］]）)".includes(text.charAt(text.length - 1)));
};

/** A division whose heading, or the label line just before it, the test names. */
const divisionNamedBy =
  (source: string, names: (text: string) => boolean): ((node: StructureNode) => boolean) =>
  (node) => {
    const heading = node.attrs["heading"];
    if (typeof heading === "string" && names(heading)) return true;
    const label = previousLineOf(source, node.span.start);
    return isLabelLine(label) && names(label);
  };

/**
 * A division its heading, or the label line just before it (【18条変更オプション条項：知財調停】), names as an alternative
 * (alternative-clause-label).
 */
export const alternativeReader = (source: string, labels: readonly string[]): ((node: StructureNode) => boolean) => {
  const words = labels.filter((label) => label !== "");
  return divisionNamedBy(source, (text) => words.some((word) => text.includes(word)));
};

/** One number or letter after the word (オプション2, Option B), not the first of a range or a list (オプション1～3, Options 1 and 2). */
const ONE_CHOICE = /^\s?(?:[0-9０-９]+|[A-ZＡ-Ｚ])(?![0-9０-９A-Za-zＡ-Ｚ])(?!\s*(?:[～〜~\-–—‐・、,，&＆]|to\b|and\b|or\b))/u;

/** The text names one choice among numbered ones: an option word (option-choice-label) followed by its number or letter. */
export const namesOneChoice = (text: string, words: readonly string[]): boolean =>
  words
    .filter((word) => word !== "")
    .some((word) =>
      text
        .split(word)
        .slice(1)
        .some((after) => ONE_CHOICE.test(after)),
    );

/**
 * A division its heading or label line names as one of numbered choices (第1条（オプション2：…）, "Option B"): only one of
 * them stays in the signed text (option-choice-label).
 */
export const choiceReader = (source: string, words: readonly string[]): ((node: StructureNode) => boolean) =>
  divisionNamedBy(source, (text) => namesOneChoice(text, words));

/** Where a line starts with a division whose number is left blank (placeholder-division: 第●条): a new run of numbers. */
export const placeholderStarts = (source: string, patterns: readonly string[]): number[] => {
  const heads = patterns.filter((pattern) => pattern !== "");
  if (heads.length === 0) return [];
  return [...source.matchAll(/^.*$/gmu)].filter((line) => heads.some((head) => line[0].trimStart().startsWith(head))).map((line) => line.index);
};
