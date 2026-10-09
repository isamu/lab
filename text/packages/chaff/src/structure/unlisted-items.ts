// unlisted-item-used: a numbered step that uses an ingredient or a tool the document's own list of what is needed (材料,
// 用意するもの, Ingredients, What you need) does not name. Only a noun in a use frame is read: the object of a use verb
// (塩を加える, add salt), and, when the document lists tools, the thing used (紙やすりで磨く, with a multi-tool) or put into
// (バケツに沈める, in a bucket). A noun is listed when the document has written it before the step (the list, the title, an
// earlier step), whole or by its last word; a noun always at hand (水, 手, water) is never reported. The words are the
// language package's (item-list-heading, item-use, item-amount, item-at-hand, enumeration-joiner).

export type ItemToken = { readonly surface: string; readonly pos: string; readonly lemma: string; readonly start: number; readonly end: number };

/** A word that marks a use frame. after: it follows the noun (を, に, で); before: it precedes it (add, with, in). */
export type UseMarker = { readonly word: string; readonly group: UseGroup; readonly position: "before" | "after" };

export type UseGroup = "object" | "place" | "instrument";

export type ItemWords = {
  readonly ingredientHeadings: readonly string[];
  readonly toolHeadings: readonly string[];
  readonly markers: readonly UseMarker[];
  /** The verbs that must follow an after-marker of each group; a group with none takes any verb. */
  readonly verbs: Readonly<Partial<Record<UseGroup, readonly string[]>>>;
  /** Words right after a verb (ず, ない) or right before it (not) that deny the use. */
  readonly negations: readonly string[];
  /** Verbs the tagger may read as nouns (stir, knead): a coordination ends at one. */
  readonly actions: readonly string[];
  readonly joiners: readonly string[];
  /** A word after which the thing itself starts again (30 ml of soy sauce). */
  readonly partitives: readonly string[];
  readonly amounts: readonly string[];
  readonly atHand: readonly string[];
};

export type ItemStep = { readonly start: number; readonly tokens: readonly ItemToken[] };

export type UnlistedItem = { readonly offset: number; readonly item: string; readonly list: string };

type ItemList = { readonly heading: string; readonly tools: boolean };

type Candidate = { readonly tokens: readonly ItemToken[]; readonly group: UseGroup };

const NOUN_POS = new Set(["NOUN", "PROPN"]);
const SKIPPED_POS = new Set(["DET", "ADJ", "NUM"]);
const CLAUSE_OPENER_POS = new Set(["PUNCT", "CCONJ", "ADV", "SCONJ", "X"]);
const HAS_DIGIT = /\p{Nd}/u;
const HEADING_TAIL_OPENER = /[（(:：【[]/u;

const lower = (text: string): string => text.toLowerCase();

/** A heading's words before a bracket or a colon, in lower case: 材料（2～3人分） is 材料. */
export const headingKey = (heading: string): string => lower((heading.split(HEADING_TAIL_OPENER)[0] ?? "").trim());

/** Spaces, hyphens and case are not a different word: multi-tool is multitool. */
export const squeezed = (text: string): string => lower(text).replace(/[\s\-‐]/gu, "");

const listKind = (heading: string, words: ItemWords): ItemList | undefined => {
  const key = headingKey(heading);
  const tools = words.toolHeadings.some((word) => lower(word) === key);
  if (!tools && !words.ingredientHeadings.some((word) => lower(word) === key)) return undefined;
  return { heading: heading.trim(), tools };
};

export const itemLists = (headings: readonly string[], words: ItemWords): ItemList[] => headings.flatMap((heading) => listKind(heading, words) ?? []);

const isWord = (token: ItemToken | undefined, words: readonly string[]): boolean =>
  token !== undefined && words.some((word) => word === token.surface || word === lower(token.surface) || word === token.lemma);

const isAmount = (token: ItemToken, words: ItemWords): boolean => HAS_DIGIT.test(token.surface) || isWord(token, words.amounts);

const isNoun = (token: ItemToken | undefined): boolean => token !== undefined && NOUN_POS.has(token.pos);

const isHyphen = (token: ItemToken | undefined): boolean => token !== undefined && /^[-‐]$/u.test(token.surface);

const BRACKET_PAIRS: Readonly<Record<string, string>> = { "）": "（", ")": "(", "」": "「", "]": "[" };

/** The index of the bracket that opens the aside closing at index, or -1 when it does not close one. */
const asideOpening = (tokens: readonly ItemToken[], index: number): number => {
  const open = BRACKET_PAIRS[tokens[index]?.surface ?? ""];
  if (open === undefined) return -1;
  return tokens.findLastIndex((token, at) => at < index && token.surface === open);
};

type Reading = { readonly segments: readonly (readonly ItemToken[])[]; readonly current: readonly ItemToken[] };

const EMPTY_READING: Reading = { segments: [], current: [] };

const closed = (reading: Reading): Reading => (reading.current.length === 0 ? reading : { segments: [...reading.segments, reading.current], current: [] });

const stepBack = (tokens: readonly ItemToken[], index: number, reading: Reading, words: ItemWords): Reading => {
  const token = tokens[index];
  if (token === undefined) return closed(reading);
  const aside = asideOpening(tokens, index);
  if (aside >= 0) return stepBack(tokens, aside - 1, reading, words);
  if (isWord(token, words.joiners)) return stepBack(tokens, index - 1, closed(reading), words);
  if (isAmount(token, words)) return stepBack(tokens, index - 1, reading, words);
  if (isNoun(token)) return stepBack(tokens, index - 1, { segments: reading.segments, current: [token, ...reading.current] }, words);
  return closed(reading);
};

/** The nouns joined before an after-marker (合いびき肉、卵、塩、こしょうを), read backwards up to the first other word. */
export const phrasesBefore = (tokens: readonly ItemToken[], marker: number, words: ItemWords): (readonly ItemToken[])[] => [
  ...stepBack(tokens, marker - 1, EMPTY_READING, words).segments,
];

const isModifier = (token: ItemToken, words: ItemWords): boolean =>
  SKIPPED_POS.has(token.pos) || isAmount(token, words) || (token.pos === "VERB" && token.surface.endsWith("ed"));

const isAction = (token: ItemToken, reading: Reading, words: ItemWords): boolean =>
  reading.current.length === 0 && reading.segments.length > 0 && isWord(token, words.actions);

const stepOn = (tokens: readonly ItemToken[], index: number, reading: Reading, words: ItemWords): Reading => {
  const token = tokens[index];
  if (token === undefined) return closed(reading);
  const next = (after: Reading): Reading => stepOn(tokens, index + 1, after, words);
  if (isWord(token, words.partitives)) return next({ segments: reading.segments, current: [] });
  if (isWord(token, words.joiners)) return next(closed(reading));
  if (isNoun(token) && !isAction(token, reading, words)) return next({ segments: reading.segments, current: [...reading.current, token] });
  if (isHyphen(token) && reading.current.length > 0 && isNoun(tokens[index + 1])) return next(reading);
  if (reading.current.length === 0 && isModifier(token, words)) return next(reading);
  return closed(reading);
};

/** The nouns joined after a before-marker (add the egg, salt and pepper), read forwards up to the first other word. */
export const phrasesAfter = (tokens: readonly ItemToken[], marker: number, words: ItemWords): (readonly ItemToken[])[] => [
  ...stepOn(tokens, marker + 1, EMPTY_READING, words).segments,
];

const markerLength = (tokens: readonly ItemToken[], index: number, word: string): number => {
  const parts = word.split(" ");
  return parts.every((part, at) => isWord(tokens[index + at], [part])) ? parts.length : 0;
};

const deniedAfter = (tokens: readonly ItemToken[], verb: number, words: ItemWords): boolean => isWord(tokens[verb + 1], words.negations);

const followedByUse = (tokens: readonly ItemToken[], index: number, group: UseGroup, words: ItemWords): boolean => {
  const verb = tokens[index + 1];
  if (verb === undefined || verb.pos !== "VERB") return false;
  const verbs = words.verbs[group] ?? [];
  return (verbs.length === 0 || isWord(verb, verbs)) && !deniedAfter(tokens, index + 1, words);
};

/** How far before a verb a negation still denies it (do not ever add). */
const NEGATION_REACH = 3;

const opensClause = (tokens: readonly ItemToken[], index: number, words: ItemWords): boolean => {
  const previous = tokens[index - 1];
  const denied = tokens.slice(Math.max(0, index - NEGATION_REACH), index).some((token) => isWord(token, words.negations));
  return !denied && (previous === undefined || CLAUSE_OPENER_POS.has(previous.pos));
};

const candidatesAt = (tokens: readonly ItemToken[], index: number, marker: UseMarker, words: ItemWords): Candidate[] => {
  if (marker.position === "after") {
    if (tokens[index]?.pos !== "ADP" || !isWord(tokens[index], [marker.word]) || !followedByUse(tokens, index, marker.group, words)) return [];
    return phrasesBefore(tokens, index, words).map((phrase) => ({ tokens: phrase, group: marker.group }));
  }
  const length = markerLength(tokens, index, marker.word);
  const object = marker.group === "object";
  if (length === 0 || (object && !opensClause(tokens, index, words))) return [];
  // The thing a step puts in or works with comes before "of" (in a bucket of water); what it adds, after it (a pinch of salt).
  const read = object ? words : { ...words, partitives: [] };
  return phrasesAfter(tokens, index + length - 1, read).map((phrase) => ({ tokens: phrase, group: marker.group }));
};

/** Every noun phrase a step uses, in the order written. */
export const usedPhrases = (tokens: readonly ItemToken[], words: ItemWords): Candidate[] =>
  tokens
    .flatMap((_, index) => words.markers.flatMap((marker) => candidatesAt(tokens, index, marker, words)))
    .toSorted((left, right) => (left.tokens[0]?.start ?? 0) - (right.tokens[0]?.start ?? 0));

const phraseText = (source: string, phrase: readonly ItemToken[]): string => source.slice(phrase[0]?.start ?? 0, phrase.at(-1)?.end ?? 0);

const isAtHand = (source: string, phrase: readonly ItemToken[], words: ItemWords): boolean => {
  const text = squeezed(phraseText(source, phrase));
  const last = phrase.at(-1);
  return words.atHand.some((word) => text.endsWith(squeezed(word)) || (last !== undefined && lower(last.lemma) === lower(word)));
};

/** The document as written and as the tagger read it: the source, and every word with its lemma (berries is berry). */
export type ItemText = { readonly source: string; readonly words: readonly ItemToken[] };

/** Written before: the whole phrase, or its last word as written or as its lemma (eggs, egg). */
const isWrittenBefore = (text: ItemText, phrase: readonly ItemToken[]): boolean => {
  const start = phrase[0]?.start ?? 0;
  const earlier = squeezed(text.source.slice(0, start));
  const last = phrase.at(-1);
  const forms = [phraseText(text.source, phrase), last?.surface ?? "", last?.lemma ?? ""].map(squeezed).filter((form) => form !== "");
  const lemma = lower(last?.lemma ?? "");
  return forms.some((form) => earlier.includes(form)) || text.words.some((word) => word.start < start && lower(word.lemma) === lemma);
};

const unlistedIn = (text: ItemText, step: ItemStep, lists: readonly ItemList[], words: ItemWords): UnlistedItem[] => {
  const tools = lists.some((list) => list.tools);
  const listNames = lists.map((list) => list.heading).join(" / ");
  return usedPhrases(step.tokens, words)
    .filter((candidate) => (candidate.group === "object" || tools) && candidate.tokens.at(-1)?.pos === "NOUN")
    .filter((candidate) => !isAtHand(text.source, candidate.tokens, words) && !isWrittenBefore(text, candidate.tokens))
    .map((candidate) => ({ offset: candidate.tokens[0]?.start ?? step.start, item: phraseText(text.source, candidate.tokens), list: listNames }));
};

/**
 * The things the numbered steps use that the document's list of what is needed does not name. Nothing when the document
 * has no such list: a document that promises no list cannot leave something off it.
 */
export const unlistedItems = (text: ItemText, headings: readonly string[], steps: readonly ItemStep[], words: ItemWords): UnlistedItem[] => {
  const lists = itemLists(headings, words);
  if (lists.length === 0) return [];
  const found = steps.flatMap((step) => unlistedIn(text, step, lists, words));
  return found.filter((item, index) => found.findIndex((other) => squeezed(other.item) === squeezed(item.item)) === index);
};
