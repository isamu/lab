/** A fenced block: code the closing shows, never only a mention of code the body gave. */
const FENCE = /^[ \t]*(?:```|~~~)/mu;
/** Inline code (`pip freeze`) and a bare or linked address (https://…). */
const CODE_OR_LINK = /`([^`\n]+)`|(https?:\/\/[^\s)>\]]+)/gu;

/**
 * Whether the closing gives code or a link the text before it did not. A closing that repeats the body's commands
 * (`python -m venv .venv` again) restates the body, the same as one that repeats its numbers.
 */
export const hasNewCodeOrLink = (closing: string, earlier: string): boolean =>
  FENCE.test(closing) || [...closing.matchAll(CODE_OR_LINK)].some((match) => !earlier.includes((match[1] ?? match[2] ?? "").trim()));

const HEADING = /^#{1,6}[ \t]/u;
const ITEM_MARKER = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]/u;
const ADDRESS = /https?:\/\//u;

/** Whether a section, its heading aside, is only list items that each carry a link: references, not a closing that could restate anything. */
export const isLinkList = (section: string): boolean => {
  const lines = section.split("\n").filter((line) => line.trim() !== "" && !HEADING.test(line));
  return lines.length > 0 && lines.every((line) => ITEM_MARKER.test(line) && ADDRESS.test(line));
};
