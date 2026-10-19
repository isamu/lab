// A list item that is the words of a link (相談窓口はこちら): the item points somewhere and is neither a sentence nor a
// name, even when the link itself was lost in a copy of the page. The endings come from the language's link-label-ending
// lexicon. Pure.

/** Marks after an item's words that are not part of them: closing punctuation, quotes and brackets, and spaces. */
const TRAILING = new Set(" \t\u3000。．.、，,!！?？;；:：」』）)]］\"”’'");

const withoutTrailing = (text: string): string => {
  const chars = text.split("");
  return chars.slice(0, chars.findLastIndex((char) => !TRAILING.has(char)) + 1).join("");
};

/** Whether an item's text ends as the words of a link do (はこちら, はこちらから). */
export const isLinkLabel = (text: string, endings: readonly string[]): boolean => {
  const lowered = withoutTrailing(text).toLowerCase();
  return endings.some((ending) => ending !== "" && lowered.endsWith(ending.toLowerCase()));
};
