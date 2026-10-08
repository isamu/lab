// A time limit a contract leaves to the reader (速やかに, 遅滞なく, promptly, within a reasonable time) where the same
// contract writes most of its limits as numbers (7日以内, within thirty days): who decides whether 速やかに was met?
// Which way to write limits is the drafter's choice; only the minority in one document is pointed at. A sentence that
// also gives a number of days (速やかに、遅くとも7日以内に) has a deadline, and a sentence that grants a right (may
// promptly suspend, 速やかに解除することができる) sets no deadline. The words come from the language package's word
// lists: vague-deadline, concrete-deadline (a stated limit: 日以内, "within … days") and deadline-permission. Pure.
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding, LexiconEntry, ProseDocument } from "../plugin.ts";

export type VagueDeadline = { readonly offset: number; readonly word: string };

type Text = { readonly start: number; readonly text: string };

type Hit = { readonly at: number; readonly word: string };

/** What the three word lists give the decision. */
export type DeadlineWords = {
  readonly vague: readonly string[];
  /** A phrase, or a frame "within … days": the second part within FRAME_REACH characters after the first. */
  readonly concrete: readonly string[];
  /** A right, not a duty: a word anywhere in the sentence, or (position: after) the sentence's ending. */
  readonly permissions: readonly LexiconEntry[];
};

const LATIN = /\p{Script=Latin}/u;
const LETTER = /\p{L}/u;
const FRAME = "…";
/** How far after "within" the unit of a frame may come: "within fourteen (14) business days". */
const FRAME_REACH = 30;
const SENTENCE_MARKS = new Set(["。", "．", ".", "!", "?", "！", "？"]);

/** The sentence without its closing marks and spaces. */
const withoutEnding = (text: string): string => {
  const chars = [...text.trimEnd()];
  const last = chars.findLastIndex((char) => !SENTENCE_MARKS.has(char) && char.trim() !== "");
  return chars.slice(0, last + 1).join("");
};

/** An English word is not read inside a longer one (promptly in unpromptly, may in mayor). */
const isWordAt = (text: string, word: string, at: number): boolean =>
  !LATIN.test(word) || (!LETTER.test(text.charAt(at - 1)) && !LETTER.test(text.charAt(at + word.length)));

const indexesOf = (text: string, word: string): number[] => {
  const found: number[] = [];
  if (word === "") return found;
  let at = text.indexOf(word);
  while (at !== -1) {
    found.push(at);
    at = text.indexOf(word, at + word.length);
  }
  return found;
};

const wordIn = (lower: string, word: string): boolean => indexesOf(lower, word.toLowerCase()).some((at) => isWordAt(lower, word, at));

/** A phrase, or a frame whose second part follows its first within reach. */
const concreteIn = (lower: string, entry: string): boolean => {
  const [lead = "", tail, ...rest] = entry
    .toLowerCase()
    .split(FRAME)
    .map((part) => part.trim());
  if (rest.length > 0) return false;
  if (tail === undefined) return lead !== "" && lower.includes(lead);
  return (
    lead !== "" &&
    tail !== "" &&
    indexesOf(lower, lead).some((at) => isWordAt(lower, lead, at) && lower.slice(at + lead.length, at + lead.length + FRAME_REACH).includes(tail))
  );
};

export const statesConcrete = (text: Text, concrete: readonly string[]): boolean => {
  const lower = text.text.toLowerCase();
  return concrete.some((entry) => concreteIn(lower, entry));
};

export const grantsRight = (text: Text, permissions: readonly LexiconEntry[]): boolean => {
  const lower = text.text.toLowerCase();
  const ending = withoutEnding(lower);
  return permissions
    .filter((entry) => entry.pattern !== "")
    .some((entry) => (entry.position === "after" ? ending.endsWith(entry.pattern.toLowerCase()) : wordIn(lower, entry.pattern)));
};

/** A hit inside a longer hit at the same place (速やかに in 可及的速やかに) is that longer word. */
const isInsideLonger = (hit: Hit, hits: readonly Hit[]): boolean =>
  hits.some((other) => other.word.length > hit.word.length && other.at <= hit.at && hit.at + hit.word.length <= other.at + other.word.length);

/** The vague limits in one sentence, in order. Matching ignores case. */
export const vagueIn = (text: Text, vague: readonly string[]): VagueDeadline[] => {
  const lower = text.text.toLowerCase();
  const hits = vague
    .filter((word) => word !== "")
    .flatMap((word) =>
      indexesOf(lower, word.toLowerCase())
        .filter((at) => isWordAt(lower, word, at))
        .map((at) => ({ at, word })),
    );
  return hits
    .filter((hit) => !isInsideLonger(hit, hits))
    .toSorted((left, right) => left.at - right.at)
    .map((hit) => ({ offset: text.start + hit.at, word: text.text.slice(hit.at, hit.at + hit.word.length) }));
};

/**
 * Each vague limit in a sentence that states no concrete one and grants no right, when more sentences of the document
 * state a concrete one than hold such a vague one: the vague limits are then the document's minority.
 */
export const vagueDeadlines = (texts: readonly Text[], words: DeadlineWords): VagueDeadline[] => {
  const perSentence = texts.map((text) => (statesConcrete(text, words.concrete) || grantsRight(text, words.permissions) ? [] : vagueIn(text, words.vague)));
  const vagueSentences = perSentence.filter((hits) => hits.length > 0).length;
  const concreteSentences = texts.filter((text) => statesConcrete(text, words.concrete)).length;
  return concreteSentences > vagueSentences ? perSentence.flat() : [];
};

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

export const vagueDeadline: Detector = (doc): Finding[] =>
  vagueDeadlines(
    doc.sentences.map((sentence) => ({ start: sentence.span.start, text: sentence.text })),
    {
      vague: patternsOf(doc, "vague-deadline"),
      concrete: patternsOf(doc, "concrete-deadline"),
      permissions: doc.lexicons["deadline-permission"] ?? [],
    },
  ).map((hit) => ({
    rule: "vague-deadline",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, hit.offset),
    values: { word: hit.word, offset: hit.offset },
  }));
