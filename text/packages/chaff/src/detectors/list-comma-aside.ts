// A comma before the last item that does not separate the items of one list: what follows it names or qualifies what
// comes before it, so the and / or after it shows no choice about the serial comma. Pure.
import type { Token } from "../plugin.ts";
import { firstAt, hasAdposition, lastContent } from "./list-item.ts";
import type { ItemScope } from "./list-sentence.ts";
import { lastOf, secondLastOf, type View } from "./list-view.ts";
import type { TokenRange } from "./token-column.ts";

/** The words an adjective phrase after a comma can qualify (automated tools, consistent with standards). */
const NOUNS: ReadonlySet<string> = new Set(["NOUN", "PROPN", "PRON"]);

const wordsOf = (scope: ItemScope, item: TokenRange): Token[] =>
  scope.sentence.tokens.slice(item.start, item.end).filter((token) => token.pos !== "PUNCT" && token.pos !== "X");

/** The item ends with a division of a code and its number (of former Title 5 / under Chapter 35). */
const endsWithDivision = (scope: ItemScope, item: TokenRange): boolean => {
  const [unit, number] = wordsOf(scope, item).slice(-2);
  return number?.pos === "NUM" && (scope.sentence.words.unit?.has(unit?.surface.toLowerCase() ?? "") ?? false);
};

/** A capitalised name without a number: the division's name, not another division. */
const isName = (scope: ItemScope, item: TokenRange): boolean => {
  const words = wordsOf(scope, item);
  return words[0]?.pos === "PROPN" && words.every((token) => token.pos !== "NUM");
};

/**
 * The name after a numbered division of a code (Title 44, Public Printing and Documents / Title 5, Executive Departments
 * and Government Officers and Employees): the and / or is inside the name. The division words are the enclosing-unit list.
 */
export const namesDivision = (view: View): boolean => {
  const { scope } = view.list;
  const [previous, last] = [secondLastOf(view), lastOf(view)];
  return previous !== undefined && last !== undefined && endsWithDivision(scope, previous.item) && isName(scope, last.item);
};

/** A phrase opened by a preposition (in accordance with law), or by an adjective that takes one (consistent with standards). */
const modifierOpening = (scope: ItemScope, item: TokenRange): "ADP" | "ADJ" | undefined => {
  const at = firstAt(scope, "open", item);
  const [opening, next] = [scope.sentence.tokens[at], scope.sentence.tokens[at + 1]];
  if (at === -1 || opening === undefined) return undefined;
  if (opening.pos === "ADP") return "ADP";
  return opening.pos === "ADJ" && next?.pos === "ADP" ? "ADJ" : undefined;
};

/**
 * The last item is a phrase that qualifies the one before it, which has nothing of its kind: "any other agency or office,
 * in accordance with law or as directed" / "using automated tools, consistent with standards and guidelines". A list of
 * such phrases has one in the item before as well ("We met in Paris, in London and in Rome"), and an adjective qualifies
 * only a noun ("It is cheap, consistent with policy and easy to run" stays a list).
 */
export const qualifiesPrevious = (view: View): boolean => {
  const { scope } = view.list;
  const [previous, last] = [secondLastOf(view), lastOf(view)];
  const kind = last === undefined ? undefined : modifierOpening(scope, last.item);
  if (previous === undefined || kind === undefined) return false;
  return kind === "ADP" ? !hasAdposition(scope, previous.item) : NOUNS.has(lastContent(scope, previous.item)?.pos ?? "");
};
