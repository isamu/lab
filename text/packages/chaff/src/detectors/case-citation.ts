// A case citation in a court opinion: the parties' names around the joiner ("ICC v. Jersey City", "Ashwander v. TVA, 297
// U.S. 288") and the court and year after a pin cite ("13 F.R.D. 335, 338 (SDNY 1952)"). Capitals there are a party's or a
// court's name as the reporter writes it, not an acronym the writer could expand. The joiner (v.) comes from the
// language's word list; only the shape is here. Pure.
import { oneOf } from "./acronym-name.ts";

type Span = { readonly start: number; readonly end: number };

const EDGE_BEFORE = String.raw`(?<![\p{L}\p{N}_&.])`;
const EDGE_AFTER = String.raw`(?![\p{L}\p{N}_&])`;
const CAPITALS = String.raw`\p{Lu}{2,}`;
/** A capitalised word of the second party's name before its capitals (United States ex rel. Chapman v. FPC). */
const NAME_WORD = String.raw`\p{Lu}[\p{L}.'’&-]*`;
/** ", 337 U.S. 426" or ", 337 U.S. at 430": the volume, the reporter and a page after a case name. */
const REPORTER = String.raw`,[ \t]+\d+[ \t]+\p{Lu}[\p{L}\p{N}. ]*?[ \t]+(?:at[ \t]+)?\d`;

const spansOf = (text: string, pattern: RegExp): Span[] =>
  [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

/** The first party in capitals, before the joiner and a second party that the reporter follows (ICC v. Jersey City, 322 U.S. 503). */
const firstParty = (joiner: string): RegExp =>
  new RegExp(String.raw`${EDGE_BEFORE}${CAPITALS}(?=[ \t]+${joiner}[ \t]+(?:${NAME_WORD}[ \t]+){0,4}${NAME_WORD}${REPORTER})`, "gu");

/** The second party in capitals, after the joiner and before the reporter (v. ICC, 337 U.S. 426; v. TVA, 297 U.S. 288). */
const secondParty = (joiner: string): RegExp =>
  new RegExp(String.raw`(?<=(?<![\p{L}\p{N}_])${joiner}[ \t]+(?:${NAME_WORD}[ \t]+){0,3})${CAPITALS}${EDGE_AFTER}(?=${REPORTER})`, "gu");

/**
 * The court and year in parentheses right after a pin cite: a page after a comma or a reporter ("F.R.D. 335, 338 (SDNY 1952)")
 * or a docket number in parentheses ("(No. 14,692d) (CC Va. 1807)"). A number after a word ("Version 2 (RFC 8305)") is not a page.
 */
const COURT_YEAR = /(?<=(?:[.,\]][ \t]+\d+|\))[ \t]+)\((?:\p{Lu}[\p{L}.]*[ \t]+){1,3}(?:1[6-9]|20)\d{2}\)/gu;

export const caseCitationSpans = (text: string, joiners: readonly string[]): Span[] => {
  const courts = spansOf(text, COURT_YEAR);
  if (joiners.length === 0) return courts;
  const joiner = oneOf(joiners);
  return [...spansOf(text, firstParty(joiner)), ...spansOf(text, secondParty(joiner)), ...courts];
};
