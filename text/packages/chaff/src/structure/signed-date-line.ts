import { escapeRegExp } from "../orthography.ts";

/**
 * A signature line that dates what its signer did: one date, one role word and the signer's name, and nothing else
 * (2026年4月12日 会計監査 戸川 隆; Jane Doe, Honorary Auditor, April 12, 2026). A sentence (2026年3月26日の定期総会で承認),
 * a line without a name, or a line naming two people is not one. Pure.
 */

const SEPARATOR = /[\s,、，:：]/u;
const MARK = /[,、，:：]/u;
const SPACES = /\s+/u;
/** A Japanese name is one or two parts (戸川 隆, 戸川隆); an English one two or three (Jane Doe, Jane Q. Doe). */
const MAX_JA_NAME_PARTS = 2;
const MIN_EN_NAME_PARTS = 2;
const MAX_EN_NAME_PARTS = 3;
/** A Japanese name part is kanji or katakana: hiragana is a particle or a verb (田中が確認, に監査を受け). */
const JA_NAME_PART = /^[\p{Script=Han}\p{Script=Katakana}ー]{1,5}$/u;
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

const isJaName = (parts: readonly string[]): boolean => parts.length <= MAX_JA_NAME_PARTS && parts.every((part) => JA_NAME_PART.test(part));

const isEnName = (parts: readonly string[]): boolean =>
  parts.length >= MIN_EN_NAME_PARTS && parts.length <= MAX_EN_NAME_PARTS && parts.every((part) => EN_NAME_PART.test(part));

const blanked = (text: string, span: LineSpan): string => `${text.slice(0, span.start)}${" ".repeat(span.end - span.start)}${text.slice(span.end)}`;

/** Where the text that is not a separator starts and ends; undefined when there is none. */
const contentOf = (text: string): LineSpan | undefined => {
  const units = text.split("");
  const start = units.findIndex((unit) => !SEPARATOR.test(unit));
  if (start < 0) return undefined;
  const end = units.findLastIndex((unit) => !SEPARATOR.test(unit)) + 1;
  return { start, end };
};

/** The text between the role and the name: the name sits wholly on one side of the role. */
const gapOf = (text: string, role: LineSpan, name: LineSpan): string | undefined => {
  if (name.end <= role.start) return text.slice(name.end, role.start);
  return name.start >= role.end ? text.slice(role.end, name.start) : undefined;
};

/**
 * The line is a signature: the date and the role each stand alone, and what is left is one name, in one piece on one side
 * of the role (山田太郎、佐藤花子 is two). An English name is set off from its role by a comma or a colon (Jane Doe, Auditor),
 * so a title (Auditor Annual Report) is not one. The role is found once the date is blanked out, so a role word inside the
 * date's text is not read.
 */
export const isSignedDateLine = (text: string, role: string, date: LineSpan): boolean => {
  if (!standsAlone(text, date.start, date.end)) return false;
  const withoutDate = blanked(text, date);
  const roleStart = occurrences(withoutDate, role).find((start) => standsAlone(withoutDate, start, start + role.length));
  if (roleStart === undefined) return false;
  const roleSpan = { start: roleStart, end: roleStart + role.length };
  const rest = blanked(withoutDate, roleSpan);
  const name = contentOf(rest);
  const gap = name === undefined ? undefined : gapOf(withoutDate, roleSpan, name);
  if (name === undefined || gap === undefined) return false;
  const nameText = rest.slice(name.start, name.end);
  if (MARK.test(nameText)) return false;
  const parts = nameText.split(SPACES);
  return isJaName(parts) || (isEnName(parts) && MARK.test(gap));
};
