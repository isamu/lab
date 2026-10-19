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
const TOPIC = "scope-topic";
const NOMINAL = "scope-nominal";
const SCOPE_GROUPS: ReadonlySet<string> = new Set([DUTY, CONDITION, TOPIC, NOMINAL, ...ON_PURPOSE]);

/** The parts of speech that end a clause with its own predicate before a comma (消去し、 行い、). */
const PREDICATE_POS: ReadonlySet<string> = new Set(["VERB", "AUX", "ADJ"]);
const PUNCT = "PUNCT";

export type ScopeWords = {
  readonly duty: readonly LexiconEntry[];
  readonly onPurpose: readonly LexiconEntry[];
  readonly condition: readonly LexiconEntry[];
  readonly topic: readonly LexiconEntry[];
  readonly nominal: readonly LexiconEntry[];
};

const inGroup = (entries: readonly LexiconEntry[], groups: readonly string[]): LexiconEntry[] => entries.filter((entry) => groups.includes(entry.group ?? ""));

export const scopeWordsOf = (entries: readonly LexiconEntry[]): ScopeWords => ({
  duty: inGroup(entries, [DUTY]),
  onPurpose: inGroup(entries, ON_PURPOSE),
  condition: inGroup(entries, [CONDITION]),
  topic: inGroup(entries, [TOPIC]),
  nominal: inGroup(entries, [NOMINAL]),
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

/** The parts of speech of the noun a clause describes (金銭の貸し借りを行う個人間融資). */
const NOUN_POS: ReadonlySet<string> = new Set(["NOUN", "PROPN"]);

/** Where the run of nouns that ends right before `index` starts. */
const nounRunStart = (tokens: readonly Token[], index: number): number =>
  index > 0 && NOUN_POS.has(tokens[index - 1]?.pos ?? "") ? nounRunStart(tokens, index - 1) : index;

/**
 * A topic word right after a noun that a clause describes (…を行う個人間融資は): the list stands in what the requirement is
 * about, not in what it asks. The clause ends in a predicate right before the noun, and a comma sets the topic off. A
 * condition noun (起きた場合は) is a condition, and a noun that names the act itself (提出することは、提出する義務は) is the duty.
 */
const describedTopicAt = (tokens: readonly Token[], index: number, words: ScopeWords): boolean => {
  const start = nounRunStart(tokens, index);
  const described = start < index && PREDICATE_POS.has(tokens[start - 1]?.pos ?? "") && tokens[index + 1]?.pos === PUNCT;
  const namesAct = startsAt(tokens, words.condition, start) || startsAt(tokens, words.nominal, start);
  return described && !namesAct && startsAt(tokens, words.topic, index);
};

type Scope = "duty" | "on-purpose" | undefined;

/**
 * What the list belongs to: the first duty, permission or prohibition word after it, or a condition word before the
 * clause the list stands in closes. undefined when none follows (the sentence's own ending decides: こと。).
 */
const scopeFrom = (tokens: readonly Token[], index: number, words: ScopeWords, inClause: boolean): Scope => {
  if (index >= tokens.length) return undefined;
  if (startsAt(tokens, words.duty, index)) return "duty";
  if (describedTopicAt(tokens, index, words)) return "on-purpose";
  if (startsAt(tokens, words.onPurpose, index) || (inClause && conditionAt(tokens, index, words))) return "on-purpose";
  return scopeFrom(tokens, index + 1, words, inClause && !closesClause(tokens, index));
};

/**
 * Whether the open word at range ends a list that is open on purpose: a condition, a permission or a prohibition holds
 * it, not the duty the requirement states. range: the tokens the open word covers.
 */
export const openOnPurpose = (tokens: readonly Token[], range: TokenRange, words: ScopeWords): boolean =>
  scopeFrom(tokens, range.end, words, true) === "on-purpose";
