// A word whose inner capitals spell out an acronym in the bracket after it: "axle (Axis-guided eXperience ELicitation)".
// The writer capitalised those letters on purpose to show where the acronym comes from; the word is not a variant of the
// same word written plainly elsewhere. Pure.

const INNER_CAPITAL = /^.\p{Ll}*\p{Lu}/u;
const ACRONYM_BEFORE = /(?:^|[^\p{L}])(\p{L}{2,8})\s*\($/u;
const CAPITAL = /\p{Lu}/gu;

const sortedLetters = (letters: string): string => [...letters.toLowerCase()].toSorted((left, right) => left.localeCompare(right)).join("");

/** The bracket that holds `offset` on its line: where it opens, and its text up to the closing bracket. */
const bracketAround = (source: string, offset: number): { readonly open: number; readonly text: string } | undefined => {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const open = source.lastIndexOf("(", offset);
  const close = source.indexOf(")", offset);
  if (open < lineStart || close === -1 || source.slice(open + 1, offset).includes(")") || source.slice(open, close).includes("\n")) return undefined;
  return { open, text: source.slice(open + 1, close) };
};

/**
 * Whether the word at `offset` has a capital past its first letter and sits in a bracket right after a short word whose
 * letters are the bracket's capitals (axle and Axis-guided eXperience ELicitation: a, x, e, l).
 */
export const spellsAcronym = (source: string, offset: number, word: string): boolean => {
  if (!INNER_CAPITAL.test(word)) return false;
  const bracket = bracketAround(source, offset);
  if (bracket === undefined) return false;
  const acronym = ACRONYM_BEFORE.exec(source.slice(Math.max(0, bracket.open - 12), bracket.open + 1))?.[1];
  return acronym !== undefined && sortedLetters(acronym) === sortedLetters((bracket.text.match(CAPITAL) ?? []).join(""));
};
