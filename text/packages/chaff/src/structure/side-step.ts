import type { StructureNode } from "../plugin.ts";

/** The label, then a gap of two or more spaces or a tab (the label column of a step list), then the step's own text. */
const LABEL_COLUMN = /^(?<word>\S+)(?: {2}|\t)/u;

/**
 * A heading labelled with a word (side-step-label: "and", "or") where a step list puts a number: a step done alongside
 * the one before it (GOV.UK's step-by-step pages). The word is matched as written, and must stand in a label column
 * like a step's number does: "and more details" is an ordinary heading.
 */
export const sideStepReader = (labels: readonly string[]): ((node: StructureNode) => boolean) => {
  const words = new Set(labels);
  return (node) => {
    const heading = node.attrs["heading"];
    if (typeof heading !== "string") return false;
    const label = LABEL_COLUMN.exec(heading);
    const word = label?.groups?.["word"];
    if (label === null || word === undefined) return false;
    return words.has(word) && heading.slice(label[0].length).trim() !== "";
  };
};
