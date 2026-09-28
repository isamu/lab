import type { Mention } from "chaffjs/plugin";
import { listMembers } from "./citation.ts";
import { parseRoman } from "./roman.ts";

// The later members of a reference list: "Sections 1, 2 and 9" names Section 9 too.

/**
 * A member is a number, as in the reference itself ("45A" is not read there either), a roman numeral in a list that
 * began with one ("Articles IV, V and VI"), or only parentheses.
 */
const MEMBER = /^(?:(?<main>\d{1,3})|(?<roman>[IVXLC]{1,7}))?(?<parens>(?:\([a-z0-9]{1,4}\))*)$/u;
const PAREN = /\(([a-z0-9]{1,4})\)/gu;

const isDigits = (part: string): boolean => /^\d+$/u.test(part);

/**
 * The part of the address before that a parenthesised member stands beside: the last one written the same way
 * (digits with digits, letters with letters). 45.3.b and (5) → 45.5; 58.2.c and (g) → 58.2.g. The main number stays.
 */
const replaceLast = (previous: readonly string[] | undefined, parens: readonly string[]): string[] | undefined => {
  const first = parens[0];
  if (previous === undefined || first === undefined) return undefined;
  const at = previous.findLastIndex((part, index) => index > 0 && isDigits(part) === isDigits(first));
  return at === -1 ? undefined : [...previous.slice(0, at), ...parens];
};

/** The main number of a member: digits as written, a roman numeral as its value, but only in a roman list. */
const mainOf = (groups: Readonly<Record<string, string | undefined>>, romanList: boolean): string | undefined => {
  const roman = groups["roman"];
  if (roman === undefined) return groups["main"];
  const value = romanList ? parseRoman(roman) : undefined;
  return value === undefined ? undefined : String(value);
};

/** A member's address, from the member before it when it is only parentheses. */
const addressOf = (member: string, previous: readonly string[] | undefined, romanList: boolean): string[] | undefined => {
  const groups = MEMBER.exec(member)?.groups ?? {};
  const parens = [...(groups["parens"] ?? "").matchAll(PAREN)].map((part) => part[1] ?? "");
  const written = groups["main"] ?? groups["roman"];
  if (written === undefined) return replaceLast(previous, parens);
  const main = mainOf(groups, romanList);
  return main === undefined ? undefined : [main, ...parens];
};

/**
 * "Sections 1, 2 and 9" → 2 and 9 as references too, with the list's numbering and document (`shared`).
 * `first` is the address of the reference that opens the list, and `end` where it ends in `text`.
 */
export const membersAfter = (
  text: string,
  end: number,
  first: readonly string[],
  shared: Readonly<Record<string, string>>,
  plural: boolean,
  romanList: boolean,
): Mention[] => {
  const mentions: Mention[] = [];
  let previous: readonly string[] | undefined = first;
  listMembers(text.slice(end), plural).forEach((member) => {
    previous = addressOf(member.text, previous, romanList);
    if (previous === undefined) return;
    const start = end + member.start;
    mentions.push({ start, end: start + member.text.length, attrs: { target: previous.join("."), label: member.text, ...shared } });
  });
  return mentions;
};
