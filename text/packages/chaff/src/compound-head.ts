import type { Token } from "./plugin.ts";

const OPENING = new Set(["（", "("]);
const CLOSING = new Set(["）", ")"]);

const isTouching = (left: Token | undefined, right: Token | undefined): boolean =>
  left !== undefined && right !== undefined && left.span.end === right.span.start;

const isNounBefore = (token: Token, next: Token | undefined, suffixes: ReadonlySet<string>): next is Token =>
  next?.pos === "NOUN" && isTouching(token, next) && !suffixes.has(next.surface);

/** A noun alone in brackets that close onto a noun (卒業（見込）証明書): the brackets mark it optional inside one compound. */
const isBracketedInCompound = (token: Token, tokens: readonly Token[], at: number, suffixes: ReadonlySet<string>): boolean => {
  const [opening, closing] = [tokens[at - 1], tokens[at + 1]];
  if (opening === undefined || closing === undefined) return false;
  if (!OPENING.has(opening.surface) || !CLOSING.has(closing.surface) || !isTouching(opening, token) || !isTouching(token, closing)) return false;
  return isNounBefore(closing, tokens[at + 2], suffixes);
};

/**
 * Whether `token`, read at `at` in `tokens`, is a noun written onto the noun after it (取扱事業者), so official Japanese may
 * drop its okurigana. A listed phrase suffix (割当て等) does not make a compound. `token` may be tokens[at] read as a noun.
 */
export const isCompoundHead = (token: Token, tokens: readonly Token[], at: number, suffixes: ReadonlySet<string>): boolean =>
  token.pos === "NOUN" && (isNounBefore(token, tokens[at + 1], suffixes) || isBracketedInCompound(token, tokens, at, suffixes));
