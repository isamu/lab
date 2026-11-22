import type { Token } from "./plugin.ts";

const OPENING = new Set(["（", "("]);
const CLOSING = new Set(["）", ")"]);

const isTouching = (left: Token | undefined, right: Token | undefined): boolean =>
  left !== undefined && right !== undefined && left.span.end === right.span.start;

const isNounBefore = (token: Token, next: Token | undefined, suffixes: ReadonlySet<string>): next is Token =>
  next?.pos === "NOUN" && isTouching(token, next) && !suffixes.has(next.surface);

/** A noun alone in brackets that close onto a noun (卒業（見込）証明書): the brackets mark it optional inside one compound. That noun. */
const nounAfterBrackets = (token: Token, tokens: readonly Token[], at: number, suffixes: ReadonlySet<string>): Token | undefined => {
  const [opening, closing] = [tokens[at - 1], tokens[at + 1]];
  if (opening === undefined || closing === undefined) return undefined;
  if (!OPENING.has(opening.surface) || !CLOSING.has(closing.surface) || !isTouching(opening, token) || !isTouching(token, closing)) return undefined;
  const next = tokens[at + 2];
  return isNounBefore(closing, next, suffixes) ? next : undefined;
};

/**
 * The noun `token`, read at `at` in `tokens`, is written onto (事業者 of 取扱事業者), when `token` is a noun at the head of a
 * compound, so official Japanese may drop its okurigana. A listed phrase suffix (割当て等) does not make a compound. `token`
 * may be tokens[at] read as a noun.
 */
export const compoundTailOf = (token: Token, tokens: readonly Token[], at: number, suffixes: ReadonlySet<string>): Token | undefined => {
  if (token.pos !== "NOUN") return undefined;
  const next = tokens[at + 1];
  return isNounBefore(token, next, suffixes) ? next : nounAfterBrackets(token, tokens, at, suffixes);
};

/** Whether `token`, read at `at` in `tokens`, is a noun written onto the noun after it (取扱事業者). */
export const isCompoundHead = (token: Token, tokens: readonly Token[], at: number, suffixes: ReadonlySet<string>): boolean =>
  compoundTailOf(token, tokens, at, suffixes) !== undefined;
