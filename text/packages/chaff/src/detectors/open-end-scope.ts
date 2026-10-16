import type { LexiconEntry, Token } from "../plugin.ts";
import { entryEndsAt, type TokenRange } from "./lexicon-match.ts";

// An open-end word in a requirement is a smell only when its list is part of what the reader is asked to do (ログ等を保存
// すること): the reader cannot tell when the duty is met. A list in the condition the duty depends on (訂正等を行った際に、
// 通知する), in a right the writer grants (投稿データ等を消去できるものとします), or in what is forbidden or excluded
// (複製、転載等をしてはならない, 事情などにより責任を負わないものとします) is left open on purpose, and is the usual way a
// contract is drafted. The words that tell the four apart come from the language's requirement-open-end lexicon, in the
// groups below. Pure.

/** The lexicon groups, in the order a tie at one token is decided: a duty word wins over the words that open a list on purpose. */
const DUTY = "scope-duty";
const ON_PURPOSE = ["scope-permission", "scope-prohibition"] as const;
const CONDITION = "scope-condition";
const SCOPE_GROUPS: ReadonlySet<string> = new Set([DUTY, CONDITION, ...ON_PURPOSE]);

/** The parts of speech that end a clause with its own predicate before a comma (消去し、 行い、). */
const PREDICATE_POS: ReadonlySet<string> = new Set(["VERB", "AUX", "ADJ"]);
const PUNCT = "PUNCT";

export type ScopeWords = { readonly duty: readonly LexiconEntry[]; readonly onPurpose: readonly LexiconEntry[]; readonly condition: readonly LexiconEntry[] };

const inGroup = (entries: readonly LexiconEntry[], groups: readonly string[]): LexiconEntry[] => entries.filter((entry) => groups.includes(entry.group ?? ""));

export const scopeWordsOf = (entries: readonly LexiconEntry[]): ScopeWords => ({
  duty: inGroup(entries, [DUTY]),
  onPurpose: inGroup(entries, ON_PURPOSE),
  condition: inGroup(entries, [CONDITION]),
});

/** Whether an entry is one of the scope cues rather than an open-end word. */
export const isScopeCue = (entry: LexiconEntry): boolean => SCOPE_GROUPS.has(entry.group ?? "");

const startsAt = (tokens: readonly Token[], entries: readonly LexiconEntry[], index: number): boolean =>
  entries.some((entry) => entryEndsAt(tokens, entry, index + (entry.tokens?.length ?? 0)));

/** A comma right after a predicate closes the clause the list stands in (消去し、). */
const closesClause = (tokens: readonly Token[], index: number): boolean => tokens[index]?.pos === PUNCT && PREDICATE_POS.has(tokens[index - 1]?.pos ?? "");

/** A condition word that closes a clause about an act (行った際, 判断される場合): it follows a predicate. */
const conditionAt = (tokens: readonly Token[], index: number, words: ScopeWords): boolean =>
  PREDICATE_POS.has(tokens[index - 1]?.pos ?? "") && startsAt(tokens, words.condition, index);

type Scope = "duty" | "on-purpose" | undefined;

/**
 * What the list belongs to: the first duty, permission or prohibition word after it, or a condition word before the
 * clause the list stands in closes. undefined when none follows (the sentence's own ending decides: こと。).
 */
const scopeFrom = (tokens: readonly Token[], index: number, words: ScopeWords, inClause: boolean): Scope => {
  if (index >= tokens.length) return undefined;
  if (startsAt(tokens, words.duty, index)) return "duty";
  if (startsAt(tokens, words.onPurpose, index) || (inClause && conditionAt(tokens, index, words))) return "on-purpose";
  return scopeFrom(tokens, index + 1, words, inClause && !closesClause(tokens, index));
};

/**
 * Whether the open word at range ends a list that is open on purpose: a condition, a permission or a prohibition holds
 * it, not the duty the requirement states. range: the tokens the open word covers.
 */
export const openOnPurpose = (tokens: readonly Token[], range: TokenRange, words: ScopeWords): boolean =>
  scopeFrom(tokens, range.end, words, true) === "on-purpose";
