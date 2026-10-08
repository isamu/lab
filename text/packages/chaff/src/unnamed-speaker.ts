// A quotation whose speaker, in the words right beside it, is a role and not a name (業界のアナリストは「…」と述べた,
// "…," said an analyst). The words come from the language's word lists: unnamed-speaker (roles, what may follow a role,
// titles, words pointing back, the quoting particle) and quote-attribution (said, according to, と述べ). Pure.
import { QUOTATION_MARKS, quotedSpans } from "./quoted-span.ts";
import type { LexiconEntry, Span } from "./plugin.ts";

export type SpeakerSentence = { readonly start: number; readonly text: string };

export type UnnamedSpeakerQuote = { readonly offset: number; readonly quote: string; readonly speaker: string };

/** The word list unnamed-speaker, by group, and quote-attribution with the list's own cues (group cue), longest first. */
export type SpeakerWords = {
  readonly roles: readonly string[];
  readonly afterRole: readonly string[];
  readonly honorifics: readonly string[];
  readonly anaphors: readonly string[];
  readonly afterQuote: readonly string[];
  readonly cues: readonly LexiconEntry[];
};

export const speakerWords = (speaker: readonly LexiconEntry[], cues: readonly LexiconEntry[]): SpeakerWords => {
  const group = (name: string): string[] => speaker.filter((entry) => entry.group === name && entry.pattern !== "").map((entry) => entry.pattern);
  return {
    roles: group("role"),
    afterRole: group("after-role"),
    honorifics: group("honorific"),
    anaphors: group("anaphor"),
    afterQuote: group("after-quote"),
    cues: [...cues, ...speaker.filter((entry) => entry.group === "cue")]
      .filter((cue) => cue.pattern !== "")
      .toSorted((left, right) => right.pattern.length - left.pattern.length),
  };
};

/** Shorter than this, a quotation is a term or a label (「保存」, "Save"), not someone's words. */
const MIN_QUOTE_CHARS = 10;

const LATIN = /\p{Script=Latin}/u;
const LETTER = /\p{L}/u;
const UPPER_START = /^\p{Lu}/u;
const LOWER_START = /^\p{Ll}/u;
const WORD = /[\p{L}\p{N}'’-]+/gu;
/** Words, and the commas between them: a comma ends a run of capitalised words (an analyst at Acme, Hanako Mori). */
const WORD_OR_COMMA = /[\p{L}\p{N}'’-]+|[,，]/gu;
/** A Japanese title is not one when a kanji follows it (氏名, 様々). */
const JOINED_KANJI = /^[\p{Script=Han}々]/u;
/** How far from the quotation the speaker is looked for, on each side: keeps a long sentence of many quotations linear. */
const SPEAKER_REACH = 200;
/** Where the clause holding the speaker before a quotation starts: after these marks. */
const CLAUSE_MARKS_BEFORE = /[。．！？!?;；「」『』“”"、，]/u;
/** Where the speaker's phrase after a quotation ends. A comma does not end it in English (said Hanako Mori, an analyst). */
const CLAUSE_MARKS_AFTER = /[。．！？.!?;；「」『』“”"]/u;
/** Where a phrase after the quoting particle (「…」と業界関係者は話す) ends. */
const CLAUSE_MARKS_PARTICLE = /[。．！？.!?;；「」『』“”"、，]/u;
/** Where a speaker standing before its cue ("…," an analyst said) must not reach past. */
const CLAUSE_MARKS_INNER = /[,，、。．！？.!?;；:：]/u;
/** Spaces and marks that join a speaker to a quotation or a cue, and are not part of either. */
const GLUE = /[\s,，、:：—–-]/u;
const PHRASE_END = /^[,，、。．.;；:：)）]/u;

/** A Latin word is matched whole and without case; a Japanese one as written, inside any text. */
const matchesAt = (text: string, at: number, word: string): boolean => {
  if (!LATIN.test(word)) return text.startsWith(word, at);
  return (
    text.slice(at, at + word.length).toLowerCase() === word.toLowerCase() && !LETTER.test(text.charAt(at - 1)) && !LETTER.test(text.charAt(at + word.length))
  );
};

const positionsOf = (text: string, word: string): number[] =>
  word === "" ? [] : [...Array(Math.max(0, text.length - word.length + 1)).keys()].filter((at) => matchesAt(text, at, word));

const startsWithWord = (text: string, word: string): boolean => matchesAt(text, 0, word);

const endsWithWord = (text: string, word: string): boolean => text.length >= word.length && matchesAt(text, text.length - word.length, word);

const afterLast = (text: string, marks: RegExp): string => {
  const cut = [...text].reduce((last, char, index) => (marks.test(char) ? index : last), -1);
  return [...text].slice(cut + 1).join("");
};

const beforeFirst = (text: string, marks: RegExp): string => {
  const at = [...text].findIndex((char) => marks.test(char));
  return at < 0 ? text : [...text].slice(0, at).join("");
};

/** The text without glue at either end. */
const clean = (text: string): string => {
  const chars = [...text];
  const first = chars.findIndex((char) => !GLUE.test(char));
  return first < 0 ? "" : chars.slice(first, chars.findLastIndex((char) => !GLUE.test(char)) + 1).join("");
};

/** leavesSpeakerBefore: after the quotation, whether the speaker may still be the one before it (「…」と述べた), not one after it (said X). */
type Side = { readonly speaker: string; readonly attributed: boolean; readonly leavesSpeakerBefore?: boolean };

/** The clause before the quotation: the speaker, with a cue at its end (An analyst said, 関係者によれば) or before it (according to). */
const speakerBefore = (before: string, words: SpeakerWords): Side => {
  const clause = clean(afterLast(clean(before), CLAUSE_MARKS_BEFORE));
  const cues = words.cues.filter((cue) => cue.position !== "after");
  const ending = cues.find((cue) => endsWithWord(clause, cue.pattern));
  if (ending !== undefined) return { speaker: clean(clause.slice(0, clause.length - ending.pattern.length)), attributed: true };
  const leads = cues
    .filter((cue) => cue.position === "before")
    .flatMap((cue) => positionsOf(clause, cue.pattern).map((at) => at + cue.pattern.length))
    .toSorted((left, right) => right - left);
  const lead = leads[0];
  if (lead !== undefined) return { speaker: clean(clause.slice(lead)), attributed: true };
  return { speaker: clause, attributed: false };
};

/** The words after the quotation: a quoting particle (「…」と業界関係者は), a cue then the speaker (said an analyst), or the speaker then a cue. */
const speakerAfter = (after: string, words: SpeakerWords): Side => {
  const rest = clean(after);
  const particle = words.afterQuote.find((word) => startsWithWord(rest, word));
  if (particle !== undefined)
    return { speaker: clean(beforeFirst(clean(rest.slice(particle.length)), CLAUSE_MARKS_PARTICLE)), attributed: true, leavesSpeakerBefore: true };
  const cues = words.cues.filter((cue) => cue.position !== "before");
  const leading = cues.find((cue) => startsWithWord(rest, cue.pattern));
  if (leading !== undefined) {
    const speaker = clean(beforeFirst(rest.slice(leading.pattern.length), CLAUSE_MARKS_AFTER));
    return { speaker, attributed: true, leavesSpeakerBefore: speaker === "" };
  }
  const clause = beforeFirst(rest, CLAUSE_MARKS_INNER);
  const cueAt = cues.flatMap((cue) => positionsOf(clause, cue.pattern)).toSorted((left, right) => left - right)[0];
  if (cueAt !== undefined) return { speaker: clean(clause.slice(0, cueAt)), attributed: true, leavesSpeakerBefore: cueAt === 0 };
  return { speaker: "", attributed: false };
};

const isCapitalised = (word: string | undefined): boolean => word !== undefined && UPPER_START.test(word);

const isRoleWord = (word: string | undefined, words: SpeakerWords): boolean =>
  word !== undefined && words.roles.some((role) => LATIN.test(role) && role.toLowerCase() === word.toLowerCase());

const isAfterRoleWord = (word: string | undefined, words: SpeakerWords): boolean =>
  word !== undefined && words.afterRole.some((entry) => entry.toLowerCase() === word.toLowerCase());

/**
 * A run of capitalised words that is a person's name (Hanako Mori, analyst Hanako Mori). Not one: a run after a word like
 * "at" (an analyst at Minato Research), a run right before a role (an Acme spokesperson), or, when the phrase opens the
 * clause, its first word alone ("An analyst", "Experts"). After a cue it is a name: said Mori, an analyst.
 */
const holdsCapitalisedName = (phrase: string, words: SpeakerWords, opensSentence: boolean): boolean => {
  const tokens = [...phrase.matchAll(WORD_OR_COMMA)].map((match) => match[0]);
  return tokens.some((token, index) => {
    if (!isCapitalised(token) || isCapitalised(tokens[index - 1])) return false;
    const runEnd = tokens.findIndex((later, at) => at > index && !isCapitalised(later));
    const end = runEnd < 0 ? tokens.length : runEnd;
    if (isAfterRoleWord(tokens[index - 1], words) || isRoleWord(tokens[end], words)) return false;
    const next = tokens[1];
    return !(opensSentence && index === 0 && end === 1 && (next === undefined || LOWER_START.test(next)));
  });
};

const holdsTitle = (phrase: string, title: string): boolean =>
  positionsOf(phrase, title).some((at) => LATIN.test(title) || !JOINED_KANJI.test(phrase.slice(at + title.length)));

const isNamed = (phrase: string, words: SpeakerWords, opensSentence: boolean): boolean =>
  words.honorifics.some((title) => holdsTitle(phrase, title)) || holdsCapitalisedName(phrase, words, opensSentence);

const lastWord = (text: string): string => [...text.matchAll(WORD)].map((match) => match[0]).at(-1) ?? "";

/** Whether the role at this place is the head of the phrase: nothing after it, or only a word like は or "at". */
const headsPhrase = (phrase: string, at: number, role: string, words: SpeakerWords): boolean => {
  const after = phrase.slice(at + role.length).trimStart();
  return after === "" || PHRASE_END.test(after) || words.afterRole.some((word) => startsWithWord(after, word));
};

const pointsBack = (phrase: string, at: number, words: SpeakerWords): boolean => {
  const before = phrase.slice(0, at).trimEnd();
  return words.anaphors.some((word) => (LATIN.test(word) ? lastWord(before).toLowerCase() === word.toLowerCase() : before.endsWith(word)));
};

/**
 * The phrase as the message shows it, when a role heads it and does not point back at someone named before (同アナリスト,
 * the analyst). A Japanese phrase is shown up to its role (業界関係者は話す as 業界関係者); an English one whole.
 */
const unnamedRoleIn = (phrase: string, words: SpeakerWords): string | undefined => {
  const heads = words.roles.flatMap((role) =>
    positionsOf(phrase, role)
      .filter((at) => headsPhrase(phrase, at, role, words) && !pointsBack(phrase, at, words))
      .map((at) => (LATIN.test(role) ? phrase : phrase.slice(0, at + role.length))),
  );
  return heads[0];
};

type Phrase = { readonly text: string; readonly opensSentence: boolean };

/** The phrases that may be the speaker: the attributed side's, and the one before when a cue after leaves the speaker there. */
const speakerPhrases = (before: Side, after: Side, beforeOpens: boolean): Phrase[] => {
  const useBefore = before.attributed || (after.attributed && after.leavesSpeakerBefore === true);
  return [
    ...(useBefore ? [{ text: before.speaker, opensSentence: beforeOpens }] : []),
    ...(after.attributed ? [{ text: after.speaker, opensSentence: false }] : []),
  ].filter((phrase) => phrase.text !== "");
};

/** The phrase that gives this quotation to a role and to no name, if any. */
const unnamedSpeakerOf = (text: string, span: Span, words: SpeakerWords): string | undefined => {
  const reach = Math.max(0, span.start - 1 - SPEAKER_REACH);
  const before = speakerBefore(text.slice(reach, span.start - 1), words);
  const after = speakerAfter(text.slice(span.end + 1, span.end + 1 + SPEAKER_REACH), words);
  const phrases = speakerPhrases(
    before,
    after,
    reach === 0 &&
      text
        .slice(0, span.start - 1)
        .trim()
        .startsWith(before.speaker),
  );
  if (phrases.some((phrase) => isNamed(phrase.text, words, phrase.opensSentence))) return undefined;
  return phrases.map((phrase) => unnamedRoleIn(phrase.text, words)).find((speaker) => speaker !== undefined);
};

/** Each quotation in the sentence given to a role with no name. */
export const unnamedSpeakerQuotes = (sentence: SpeakerSentence, words: SpeakerWords): UnnamedSpeakerQuote[] => {
  if (words.roles.length === 0) return [];
  return quotedSpans(sentence.text, QUOTATION_MARKS).flatMap((span) => {
    const quote = clean(sentence.text.slice(span.start, span.end));
    if ([...quote].length < MIN_QUOTE_CHARS) return [];
    const speaker = unnamedSpeakerOf(sentence.text, span, words);
    return speaker === undefined ? [] : [{ offset: sentence.start + span.start, quote, speaker }];
  });
};
