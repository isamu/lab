import type { Token } from "../plugin.ts";
import { isFiniteVerb } from "./list-item-phrase.ts";

/** Words opening with a subject pronoun and its finite verb (you will also need a change of clothes): a sentence, closed or not. */
export const opensWithClause = (words: readonly Token[], isSubject: (token: Token) => boolean): boolean => {
  const [subject, ...rest] = words;
  const verb = rest.find((token) => token.pos !== "ADV");
  return subject !== undefined && verb !== undefined && isSubject(subject) && isFiniteVerb(verb);
};
