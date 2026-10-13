// Whether a first sentence says something about its heading's subject, rather than announcing or restating it. Pure;
// heading-echo reads it. The words that only announce or point (covers, below, 説明, 以下), the copulas and the
// negations come from the language package's heading-announcer lexicon.
import { isContent } from "./content-morphemes.ts";
import type { LexiconEntry, Token } from "../plugin.ts";

type Side = "before" | "after";

export type AnnouncerWords = {
  /** Words that announce the section or point at it: they carry no claim of their own. */
  readonly announcing: ReadonlySet<string>;
  /** Copulas (be, です), each with the side its complement stands on. */
  readonly copulas: ReadonlyMap<string, Side>;
  /** Words that deny what a copula links (There are no issues, is not in the manual): the denial is the claim. */
  readonly negations: ReadonlySet<string>;
};

const patternsOf = (entries: readonly LexiconEntry[], group: string | undefined): Set<string> =>
  new Set(entries.filter((entry) => entry.group === group).map((entry) => entry.pattern.toLowerCase()));

export const announcerWords = (entries: readonly LexiconEntry[]): AnnouncerWords => ({
  announcing: patternsOf(entries, undefined),
  copulas: new Map(entries.flatMap((entry): [string, Side][] => (entry.group === "copula" ? [[entry.pattern.toLowerCase(), entry.position ?? "after"]] : []))),
  negations: patternsOf(entries, "negation"),
});

const baseForm = (token: Token): string => (token.lemma ?? token.surface).toLowerCase();

/** Between a copula and its complement: not, very, the (is not the, are very). */
const BRIDGING_POS = new Set(["ADV", "PART", "DET"]);

/** What a copula at `at` links to, on its complement's side: the bridging words, then the complement when there is one. */
const linkedBy = (tokens: readonly Token[], at: number, side: Side): Token[] => {
  const outward = side === "after" ? tokens.slice(at + 1) : tokens.slice(0, at).reverse();
  const complementAt = outward.findIndex((token) => !BRIDGING_POS.has(token.pos));
  return complementAt === -1 ? outward : outward.slice(0, complementAt + 1);
};

/** An -ing form or a past participle names or modifies (Moving through the process, An object representing a server); it predicates only after a copula. */
const NON_FINITE = new Set(["Ger", "Part"]);

const isFiniteVerb = (token: Token): boolean => token.pos === "VERB" && !NON_FINITE.has(token.features?.["VerbForm"] ?? "");

type Predicate = { readonly words: readonly Token[]; readonly negations: readonly Token[] };

const copulaPredicate = (tokens: readonly Token[], at: number, side: Side, words: AnnouncerWords): Predicate => {
  const linked = linkedBy(tokens, at, side);
  return { words: linked.filter((word) => !BRIDGING_POS.has(word.pos)), negations: linked.filter((word) => words.negations.has(baseForm(word))) };
};

/** A finite verb that is no copula, a word turned into a verb by a light verb (変更し), or a copula's complement. */
const predicatesOf = (tokens: readonly Token[], words: AnnouncerWords): Predicate[] =>
  tokens.flatMap((token, index): Predicate[] => {
    const side = words.copulas.get(baseForm(token));
    if (side !== undefined) return [copulaPredicate(tokens, index, side, words)];
    const lightVerbNext = tokens[index + 1]?.features?.["VerbType"] === "Light";
    return isFiniteVerb(token) || lightVerbNext ? [{ words: [token], negations: [] }] : [];
  });

/**
 * The sentence has a predicate of its own: a word that is not one of the heading's words and does not only announce or
 * point (covers, below, 説明, 以下), or a denial the heading does not make. "All charges include sales tax." says
 * something about charges; "This section covers installation." and "The full reference is in the manual." do not.
 */
export const makesClaim = (heading: readonly Token[], sentence: readonly Token[], words: AnnouncerWords): boolean => {
  const said = new Set(heading.map(baseForm));
  const unsaid = (token: Token): boolean => !said.has(baseForm(token));
  const ownWord = (token: Token): boolean => isContent(token) && unsaid(token) && !words.announcing.has(baseForm(token)) && !words.copulas.has(baseForm(token));
  return predicatesOf(sentence, words).some((predicate) => predicate.negations.some(unsaid) || predicate.words.some(ownWord));
};
