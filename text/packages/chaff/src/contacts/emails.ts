// Email addresses written two ways in one document (support@hibari-lab.example and suport@hibari-lab.example). Two addresses
// are one contact misspelt only when everything but one word of them is the same, so sales@ and support@ of one domain, or
// one mailbox at two domains that differ by more than a slip, stay apart. Pure.
import { writingVariants, type Variant, type Writing } from "./variants.ts";

export type EmailWriting = Writing;

const EMAIL = /(?<![\w.%+-])[a-z0-9][a-z0-9._%+-]*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+/giu;
const SEPARATOR = /[.@\-_+%]/u;
const SEPARATORS = /[.\-_]/gu;
const DIGIT = /\d/u;
/** A word shorter than this is a whole name (hr, pr, jp, sale, info), not one to be misspelt. */
const MIN_WORD_LENGTH = 5;
/** Longer than this, a word is an id rather than a name, and is not compared. */
const MAX_WORD_LENGTH = 64;
/** From this length a word may differ by two edits and still be a slip; a shorter one by one. */
const TWO_EDIT_LENGTH = 6;

/** The email addresses of a text, lower-cased into their key. */
export const emailWritings = (text: string): EmailWriting[] =>
  [...text.matchAll(EMAIL)].map((match) => ({ offset: match.index, written: match[0], key: match[0].toLowerCase() }));

/** Edits (insert, delete, replace, swap of neighbours) between two short strings: the optimal string alignment distance. */
export const editDistance = (a: string, b: string): number => {
  const rows = [...a].reduce<number[][]>(
    (done, charA, i) => {
      const previous = done[i] ?? [];
      const row = [...b].reduce<number[]>(
        (cells, charB, j) => {
          const cost = charA === charB ? 0 : 1;
          const swapped = i > 0 && j > 0 && charA === b[j - 1] && a[i - 1] === charB ? (done[i - 1]?.[j - 1] ?? Infinity) + 1 : Infinity;
          return [...cells, Math.min((previous[j + 1] ?? Infinity) + 1, (cells[j] ?? Infinity) + 1, (previous[j] ?? Infinity) + cost, swapped)];
        },
        [i + 1],
      );
      return [...done, row];
    },
    [[...Array(b.length + 1).keys()]],
  );
  return rows.at(-1)?.at(-1) ?? 0;
};

const separatorsOf = (address: string): string => [...address].filter((char) => SEPARATOR.test(char)).join("");

/** One word of the two differs, by a slip: both long enough, no digits (support1@ and support2@ are two mailboxes). */
const oneWordSlip = (a: string, b: string): boolean => {
  if (separatorsOf(a) !== separatorsOf(b)) return false;
  const wordsA = a.split(SEPARATOR);
  const wordsB = b.split(SEPARATOR);
  const differing = wordsA.flatMap((word, index): [string, string][] => (word === wordsB[index] ? [] : [[word, wordsB[index] ?? ""]]));
  const [pair] = differing;
  if (differing.length !== 1 || pair === undefined) return false;
  const [wordA, wordB] = pair;
  const shorter = Math.min(wordA.length, wordB.length);
  if (shorter < MIN_WORD_LENGTH || Math.max(wordA.length, wordB.length) > MAX_WORD_LENGTH || DIGIT.test(wordA) || DIGIT.test(wordB)) return false;
  return editDistance(wordA, wordB) <= (shorter >= TWO_EDIT_LENGTH ? 2 : 1);
};

/** Whether two addresses are one written two ways: a dot or hyphen dropped or added, or one word misspelt. */
export const isEmailSlip = (a: string, b: string): boolean => a !== b && (a.replaceAll(SEPARATORS, "") === b.replaceAll(SEPARATORS, "") || oneWordSlip(a, b));

/** Every writing of an address that is another address of the document written with a slip, with that other address. */
export const emailVariants = (text: string): Variant<EmailWriting>[] => writingVariants(emailWritings(text), (a, b) => isEmailSlip(a.key, b.key));
