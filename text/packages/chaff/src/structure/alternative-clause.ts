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

/**
 * A division its heading, or the line just before it (【18条変更オプション条項：知財調停】), names as an alternative
 * (alternative-clause-label).
 */
export const alternativeReader = (source: string, labels: readonly string[]): ((node: StructureNode) => boolean) => {
  const words = labels.filter((label) => label !== "");
  const names = (text: string): boolean => words.some((word) => text.includes(word));
  return (node) => {
    const heading = node.attrs["heading"];
    return (typeof heading === "string" && names(heading)) || names(previousLineOf(source, node.span.start));
  };
};

/** Where a line starts with a division whose number is left blank (placeholder-division: 第●条): a new run of numbers. */
export const placeholderStarts = (source: string, patterns: readonly string[]): number[] => {
  const heads = patterns.filter((pattern) => pattern !== "");
  if (heads.length === 0) return [];
  return [...source.matchAll(/^.*$/gmu)].filter((line) => heads.some((head) => line[0].trimStart().startsWith(head))).map((line) => line.index);
};
