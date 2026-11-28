// A list inside a byline (By Jason Wells, Section Chief for State, Local, Tribal and Territorial, Infrastructure Security
// Division): the writer's name and title of office, whose commas belong to the office's name, not to the writer's style. Pure.
import type { Token } from "../plugin.ts";

const VERBS: ReadonlySet<string> = new Set(["VERB", "AUX"]);
const SENTENCE_END = /^[.!?]$/u;

const isCapitalised = (token: Token | undefined): boolean => /^\p{Lu}/u.test(token?.surface ?? "");

/**
 * A line that opens with By and a name, has no verb and does not close like a sentence. Other lines of names (a list of
 * attendees) are not taken: their votes stand until the list reader tells their clauses from items on its own.
 */
const isByline = (tokens: readonly Token[]): boolean => {
  const [by, name, last] = [tokens[0], tokens[1], tokens.at(-1)];
  if (by?.surface !== "By" || name?.pos !== "PROPN" || last === undefined || SENTENCE_END.test(last.surface)) return false;
  return !tokens.some((token) => VERBS.has(token.pos));
};

/** Whether the and / or at `at` joins capitalised words of the title in a byline. */
export const insideByline = (tokens: readonly Token[]): ((at: number) => boolean) => {
  const byline = isByline(tokens);
  return (at) => byline && isCapitalised(tokens[at - 1]) && isCapitalised(tokens[at + 1]);
};
