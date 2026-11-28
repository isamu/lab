import type { Token } from "../plugin.ts";

// Sentences around a comparative that already say what it is compared with, though no baseline word names it. Pure.

const lower = (token: Token | undefined): string => token?.surface.toLowerCase() ?? "";

const isSpace = (token: Token): boolean => token.surface.trim() === "";

/** The index of the sentence's first word, past leading spaces. */
const firstWordAt = (tokens: readonly Token[]): number => tokens.findIndex((token) => !isSpace(token));

const wordOf = (token: Token): readonly string[] => [lower(token), token.lemma?.toLowerCase() ?? ""];

/**
 * A word inside the sentence, before the comparative, that names the change or the alternative it follows from: a cause
 * (これにより、…ことにより、…できるため、) or a contrast (Print statements work, but a debugger is better). The word must
 * follow another word: the clause before it is what the comparison sets itself against.
 */
export const followsCause = (tokens: readonly Token[], first: Token, causes: ReadonlySet<string>): boolean => {
  const opening = firstWordAt(tokens);
  return tokens.some((token, at) => at > opening && token.span.end <= first.span.start && wordOf(token).some((word) => causes.has(word)));
};

/** The sentence opens with a word that puts it after a change or a topic it names (As the application grows, …; By pairing …, …). */
export const opensWithCause = (tokens: readonly Token[], openers: ReadonlySet<string>): boolean => openers.has(lower(tokens[firstWordAt(tokens)]));

/** How far before the comparative a verb that makes it a change from now may stand (make the system meet their needs better). */
const MAKER_REACH = 6;

const CLAUSE_BREAK = new Set([",", ";", ":"]);

/** A verb shortly before the comparative, in its clause, makes it a change from the present state (to make results more predictable, we can do better). */
export const madeComparative = (tokens: readonly Token[], first: Token, makers: ReadonlySet<string>): boolean => {
  const at = tokens.indexOf(first);
  const reach = tokens.slice(Math.max(0, at - MAKER_REACH), at);
  const clause = reach.slice(reach.findLastIndex((token) => CLAUSE_BREAK.has(token.surface)) + 1);
  return clause.some((token) => (token.pos === "VERB" || token.pos === "AUX") && makers.has(lower(token)));
};

/** A condition word with its negation attached (couldn't, wouldn’t) is the condition word. */
export const withoutNegation = (word: string): string => word.replace(/n['’]t$/u, "");

/** A comparative is the subject of the predicate, opening its clause: a maxim weighing two comparatives (simpler is better). */
export const comparesComparatives = (tokens: readonly Token[], headAt: number, comparatives: ReadonlySet<string>): boolean => {
  const subject = tokens[headAt - 1];
  const before = tokens[headAt - 2];
  return comparatives.has(lower(subject)) && (before === undefined || isSpace(before) || CLAUSE_BREAK.has(before.surface));
};

const MODIFIER = new Set(["ADJ", "VERB"]);

const nounWord = (token: Token): string => token.lemma?.toLowerCase() ?? lower(token);

/** The subject noun before the predicate head, past adverbs (A blurred background usually looks better → background). */
const subjectAt = (tokens: readonly Token[], headAt: number): number => {
  const at = tokens.slice(0, headAt).findLastIndex((token) => token.pos !== "ADV" && !isSpace(token));
  return tokens[at]?.pos === "NOUN" ? at : -1;
};

/**
 * The subject is one kind of a thing the sentence before names as another kind (Virtual backgrounds are fine, … A blurred
 * background looks better): the same noun under a different modifier, so the comparison is between the two kinds.
 */
export const comparesKinds = (previous: readonly Token[], tokens: readonly Token[], head: Token | undefined): boolean => {
  if (head === undefined) return false;
  const at = subjectAt(tokens, tokens.indexOf(head));
  const [modifier, subject] = [tokens[at - 1], tokens[at]];
  if (at === -1 || subject === undefined || modifier === undefined || !MODIFIER.has(modifier.pos)) return false;
  const noun = nounWord(subject);
  return previous.some(
    (token, index) =>
      token.pos === "NOUN" && nounWord(token) === noun && MODIFIER.has(previous[index - 1]?.pos ?? "") && lower(previous[index - 1]) !== lower(modifier),
  );
};
