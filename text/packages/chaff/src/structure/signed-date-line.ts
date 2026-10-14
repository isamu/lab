import { escapeRegExp } from "../orthography.ts";

/**
 * A signature line that dates what its signer did: one date, one role word and the signer's name, and nothing else
 * (2026年4月12日 会計監査 戸川 隆; Jane Doe, Honorary Auditor, April 12, 2026). A sentence (2026年3月26日の定期総会で承認),
 * a line without a name, or a line naming two people is not one. Pure.
 */

const SEPARATOR = /[\s,、，:：]/u;
const SEPARATORS = /[\s,、，:：]+/u;
/** A Japanese name is one or two parts (戸川 隆, 戸川隆); an English one up to three (Jane Q. Doe). */
const MAX_JA_NAME_PARTS = 2;
const MAX_EN_NAME_PARTS = 3;
/** A Japanese name part holds a kanji or katakana: a part of hiragana alone is a particle or a verb ending (に, を受けました). */
const JA_NAME_PART = /^(?=.*[\p{Script=Han}\p{Script=Katakana}])[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}ー]{1,5}$/u;
/** An English name part is capitalised, or an initial with its full stop. */
const EN_NAME_PART = /^\p{Lu}(?:\.|[\p{L}'’-]+)$/u;

/** Where a date sits on the line: from start to end, counted from the line's start. */
export type LineSpan = { readonly start: number; readonly end: number };

const isEdge = (text: string, index: number): boolean => index < 0 || index >= text.length || SEPARATOR.test(text.charAt(index));

const standsAlone = (text: string, start: number, end: number): boolean => isEdge(text, start - 1) && isEdge(text, end);

const occurrences = (text: string, word: string): number[] => [...text.matchAll(new RegExp(escapeRegExp(word), "gu"))].map((match) => match.index);

/** The role word of roles standing alone on the line (between separators or at an edge), the longest first. */
export const signerRoleOf = (text: string, roles: readonly string[]): string | undefined =>
  [...roles]
    .sort((one, other) => other.length - one.length)
    .find((role) => occurrences(text, role).some((start) => standsAlone(text, start, start + role.length)));

const isName = (parts: readonly string[]): boolean => {
  const ja = parts.every((part) => JA_NAME_PART.test(part)) && parts.length <= MAX_JA_NAME_PARTS;
  const en = parts.every((part) => EN_NAME_PART.test(part)) && parts.length <= MAX_EN_NAME_PARTS;
  return parts.length > 0 && (ja || en);
};

const blanked = (text: string, start: number, end: number): string => `${text.slice(0, start)} ${text.slice(end)}`;

/**
 * The line is a signature: the date and the role each stand alone, and what is left is one name. The role is found
 * once the date is blanked out, so a role word inside the date's text is not read.
 */
export const isSignedDateLine = (text: string, role: string, date: LineSpan): boolean => {
  if (!standsAlone(text, date.start, date.end)) return false;
  const withoutDate = blanked(text, date.start, date.end);
  const roleStart = occurrences(withoutDate, role).find((start) => standsAlone(withoutDate, start, start + role.length));
  if (roleStart === undefined) return false;
  const rest = blanked(withoutDate, roleStart, roleStart + role.length);
  return isName(rest.split(SEPARATORS).filter((part) => part !== ""));
};
