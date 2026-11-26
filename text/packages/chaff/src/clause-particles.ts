import type { Token } from "./plugin.ts";
import { touches } from "./bound-word-particles.ts";

// Particles that look like a link of a nesting chain (の) but do not nest a noun in a noun, and the predicates that
// close a chain. Pure.

/** The counted particles (particles) written straight after a word that only picks out which ones (他の: words). */
export const determinerParticles = (tokens: readonly Token[], particles: readonly string[], words: readonly string[]): ReadonlySet<Token> =>
  new Set(tokens.filter((token, at) => particles.includes(token.surface) && touches(tokens[at - 1], token) && words.includes(tokens[at - 1]?.surface ?? "")));

/** A verb that ends a clause: in its dictionary form (定める) or followed by an auxiliary (つい of ついた), not a stem that starts a compound noun (繰下げ of 繰下げ受給). */
const endsClause = (verb: Token, after: Token | undefined): boolean => verb.pos === "VERB" && (verb.surface === verb.lemma || after?.pos === "AUX");

/**
 * The verbs written straight after a counted particle (番号のついた版): that の marks the subject of a clause as が would,
 * and the clause ends at its verb, so the noun after it starts a new phrase. The の itself still counts, in the phrase before.
 */
export const clauseEnds = (tokens: readonly Token[], particles: readonly string[]): ReadonlySet<Token> =>
  new Set(
    tokens.filter((token, at) => endsClause(token, tokens[at + 1]) && particles.includes(tokens[at - 1]?.surface ?? "") && touches(tokens[at - 1], token)),
  );

/**
 * The ある of a copula である (子会社である法人): the clause before it says what the next noun is. It ends a phrase only
 * when the clause holds a single particle (当社の子会社である): a clause that nests itself (県の対策のトップである) is read with the run.
 */
export const copulaEnds = (tokens: readonly Token[]): ReadonlySet<Token> =>
  new Set(
    tokens.filter((token, at) => {
      const before = tokens[at - 1];
      return token.pos === "AUX" && token.surface === "ある" && before?.pos === "AUX" && before.surface === "で" && touches(before, token);
    }),
  );

const endsBetween = (left: Token, right: Token, ends: ReadonlySet<Token>): boolean =>
  [...ends].some((verb) => verb.span.start >= left.span.end && verb.span.end <= right.span.start);

/**
 * The most particles of a run (in order) that no clause end (ends) falls between: 2 for 特定の番号の|ついた版の. 0 for none.
 * A copula end (copulas) falls between only after a part of one particle: 2 for 当社の|子会社である東西商事の株式の, 3 for 県の対策のトップである部の.
 */
export const longestClausePart = (run: readonly Token[], ends: ReadonlySet<Token>, copulas: ReadonlySet<Token> = new Set()): number =>
  run.reduce<{ readonly current: number; readonly longest: number }>(
    (acc, token, at) => {
      const previous = run[at - 1];
      const breaks = previous !== undefined && (endsBetween(previous, token, ends) || (acc.current === 1 && endsBetween(previous, token, copulas)));
      const current = breaks ? 1 : acc.current + 1;
      return { current, longest: Math.max(acc.longest, current) };
    },
    { current: 0, longest: 0 },
  ).longest;
