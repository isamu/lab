// A duty that happens at a point in time (pay, deliver, return, notify; 支払う, 提出する, 通知する) written with no time at
// all, in a contract that gives most of its other duties a limit: by when must it be done? The drafter decides whether
// duties carry limits, so only the minority in one document is pointed at, as vague-deadline does. A sentence holding
// a vague limit (promptly) is vague-deadline's; one stating an amount (pays a fee of $9,000) sets a price, and its
// timing is another clause's. The words come from the language package's word lists: timed-duty (the act),
// duty-marker (shall, will), duty-ending (う, するものとする: what may follow a Japanese act at the sentence end),
// stated-deadline (by the, までに) with concrete-deadline and vague-deadline, deadline-permission and currency-notation. Pure.
import { quoteAt } from "./structure-tree.ts";
import { escapeRegExp } from "../orthography.ts";
import { grantsRight, statesConcrete, vagueIn } from "./vague-deadline.ts";
import type { Detector, Finding, LexiconEntry, ProseDocument } from "../plugin.ts";

export type UntimedDuty = { readonly offset: number; readonly act: string };

/** sameLine: the sentence goes on the line of the one before it (no line break between them). */
type Text = { readonly start: number; readonly text: string; readonly sameLine?: boolean };

/** What the word lists give the decision. */
export type DutyWords = {
  readonly acts: readonly string[];
  readonly markers: readonly string[];
  /** Words that, between the marker and the act, make the duty one not to act (will not submit). */
  readonly negations: readonly string[];
  readonly endings: readonly string[];
  /** Phrases or frames that give a sentence a limit: concrete-deadline and stated-deadline. */
  readonly limits: readonly string[];
  /** Words that, where they stand, are no limit though a limit's words are in them (解除の日までの委託料: までの). */
  readonly notLimits: readonly string[];
  readonly vague: readonly string[];
  /** Words that send the reader to other terms for how the act is done (according to the terms in the Order Form). */
  readonly deferrals: readonly string[];
  readonly permissions: readonly LexiconEntry[];
  readonly currencies: readonly LexiconEntry[];
};

const LATIN = /\p{Script=Latin}/u;
const LETTER = /\p{L}/u;
const DIGIT = /\p{Nd}/u;
const SENTENCE_MARKS = new Set(["。", "．", ".", "!", "?", "！", "？", ";", ":"]);
/** How many words may stand between the duty marker and the act: "shall, at its option, return". */
const MARKER_REACH_WORDS = 4;
/** How far before an amount's trailing mark its number may end (88万円, 1,000 円). */
const AMOUNT_REACH = 3;

const withoutEnding = (text: string): string => {
  const chars = [...text.trimEnd()];
  const last = chars.findLastIndex((char) => !SENTENCE_MARKS.has(char) && char.trim() !== "");
  return chars.slice(0, last + 1).join("");
};

const latinWords = (lower: string): { readonly word: string; readonly at: number }[] =>
  [...lower.matchAll(/[\p{L}']+/gu)].map((match) => ({ word: match[0], at: match.index }));

/** The act a Latin-script duty binds: an act word within reach after a duty marker (shall return, will notify). */
const latinActAt = (lower: string, words: DutyWords): { readonly act: string; readonly at: number } | undefined => {
  const tokens = latinWords(lower);
  const markerWords = words.markers.map((marker) => marker.toLowerCase().split(/\s+/u));
  const markerEnds = tokens.flatMap((_, index) =>
    markerWords.filter((parts) => parts.every((part, offset) => tokens[index + offset]?.word === part)).map((parts) => index + parts.length),
  );
  const acts = new Set(words.acts.map((act) => act.toLowerCase()));
  const negations = new Set(words.negations.map((word) => word.toLowerCase()));
  return markerEnds
    .flatMap((end) => {
      const reach = tokens.slice(end, end + MARKER_REACH_WORDS);
      const act = reach.findIndex((token) => acts.has(token.word));
      const found = reach[act];
      return found === undefined || reach.slice(0, act).some((token) => negations.has(token.word)) ? [] : [found];
    })
    .map((token) => ({ act: token.word, at: token.at }))[0];
};

/** The act a duty written as the sentence's last predicate binds (支払う, 通知するものとする, 通知します). */
const endingActAt = (text: string, words: DutyWords): { readonly act: string; readonly at: number } | undefined => {
  const ending = withoutEnding(text);
  const act = words.acts.find((stem) => stem !== "" && words.endings.some((tail) => ending.endsWith(`${stem}${tail}`)));
  if (act === undefined) return undefined;
  return { act, at: ending.lastIndexOf(act) };
};

const actIn = (text: string, words: DutyWords): { readonly act: string; readonly at: number } | undefined =>
  words.acts.some((act) => LATIN.test(act)) ? latinActAt(text.toLowerCase(), words) : endingActAt(text, words);

/** An amount (¥1,000, 1,000円, $9,000) in the sentence: it sets what is paid, and when is another clause's. */
export const statesAmount = (text: string, currencies: readonly LexiconEntry[]): boolean =>
  currencies
    .filter((entry) => entry.pattern !== "")
    .some((entry) => {
      const parts = text.split(entry.pattern);
      return parts.slice(1).some((after, index) => {
        const before = parts[index] ?? "";
        return entry.position === "before" ? DIGIT.test(after.trimStart().charAt(0)) : DIGIT.test(before.trimEnd().slice(-AMOUNT_REACH));
      });
    });

const isWordStart = (text: string, at: number): boolean => !LETTER.test(text.charAt(at - 1));

/** The sentence with the words that are no limit blanked out, so that a limit's words inside them are not read. */
const withoutNotLimits = (text: Text, notLimits: readonly string[]): Text => ({
  start: text.start,
  text: notLimits.filter((word) => word !== "").reduce((masked, word) => masked.replaceAll(word, " ".repeat(word.length)), text.text),
});

const FRAME = "…";

/** A phrase in the sentence; a Latin one only as whole words (by the, not by their). */
const phraseIn = (text: string, phrase: string): boolean => {
  const lower = text.toLowerCase();
  const wanted = phrase.toLowerCase().trim();
  if (wanted === "") return false;
  if (!LATIN.test(wanted)) return lower.includes(wanted);
  return [...lower.matchAll(new RegExp(escapeRegExp(wanted), "gu"))].some(
    (match) => !LETTER.test(lower.charAt(match.index - 1)) && !LETTER.test(lower.charAt(match.index + wanted.length)),
  );
};

/** A limit in the sentence: a frame (within … days) or a phrase (by the, までに), outside the words that are no limit. */
const statesLimit = (text: Text, words: DutyWords): boolean => {
  const masked = withoutNotLimits(text, words.notLimits);
  const frames = words.limits.filter((limit) => limit.includes(FRAME));
  return statesConcrete(masked, frames) || words.limits.some((limit) => !limit.includes(FRAME) && phraseIn(masked.text, limit));
};

const limited = (text: Text, words: DutyWords): boolean => statesLimit(text, words) || vagueIn(text, words.vague).length > 0;

/** For each sentence, the index after the last sentence on its line: the time of a duty often follows it (Fees are due within 30 days). */
const lineEnds = (texts: readonly Text[]): number[] => {
  const ends: number[] = [];
  texts.reduceRight((after, _text, index) => {
    const end = texts[index + 1]?.sameLine === true ? after : index + 1;
    ends[index] = end;
    return end;
  }, texts.length);
  return ends;
};

/**
 * Each duty to act at a point in time whose sentence, and the rest of whose line, states no limit, holds no vague one, grants no right and states
 * no amount, when more sentences of the document state a limit than hold such a duty: these duties are then the
 * document's minority.
 */
export const untimedDuties = (texts: readonly Text[], words: DutyWords): UntimedDuty[] => {
  const ends = lineEnds(texts);
  const found = texts.flatMap((text, index) => {
    const line = texts.slice(index, ends[index]);
    if (line.some((later) => limited(later, words) || words.deferrals.some((deferral) => phraseIn(later.text, deferral)))) return [];
    if (grantsRight(text, words.permissions) || statesAmount(text.text, words.currencies)) return [];
    const act = actIn(text.text, words);
    if (act === undefined || (LATIN.test(act.act) && !isWordStart(text.text, act.at))) return [];
    return [{ offset: text.start + act.at, act: text.text.slice(act.at, act.at + act.act.length) }];
  });
  const limitedSentences = texts.filter((text) => statesLimit(text, words)).length;
  return limitedSentences > found.length ? found : [];
};

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

export const obligationWithoutDeadline: Detector = (doc): Finding[] =>
  untimedDuties(
    doc.sentences.map((sentence, index) => ({
      start: sentence.span.start,
      text: sentence.text,
      sameLine: index > 0 && !doc.source.slice(doc.sentences[index - 1]?.span.end ?? 0, sentence.span.start).includes("\n"),
    })),
    {
      acts: patternsOf(doc, "timed-duty"),
      markers: patternsOf(doc, "duty-marker"),
      negations: patternsOf(doc, "duty-negation"),
      endings: patternsOf(doc, "duty-ending"),
      limits: [...patternsOf(doc, "concrete-deadline"), ...patternsOf(doc, "stated-deadline")],
      notLimits: patternsOf(doc, "stated-deadline-not"),
      vague: patternsOf(doc, "vague-deadline"),
      deferrals: patternsOf(doc, "duty-terms-elsewhere"),
      permissions: doc.lexicons["deadline-permission"] ?? [],
      currencies: doc.lexicons["currency-notation"] ?? [],
    },
  ).map((duty) => ({
    rule: "obligation-without-deadline",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, duty.offset),
    values: { word: duty.act, offset: duty.offset },
  }));
