// filler-word: hesitation words left in minutes or notes made from a transcript (ええと、 um,). Pure.
// The words come from the word list. An entry of group set-off is a word with another use (まあまあ, あの件, "as you
// know"), so it counts only where it stands apart: at the sentence's head or after a comma, with a pause after it.
// Every other entry needs a pause (or a space) after it. Words inside a quotation are someone's words, kept as said.
import type { Detector, Finding, LexiconEntry, ProseDocument, Sentence, Span } from "../plugin.ts";
import { isWithinAny, QUOTATION_MARKS, quotedIn } from "../quoted-span.ts";

const SET_OFF = "set-off";
const PAUSES_AFTER: readonly string[] = ["、", "，", ",", "…", "...", "—"];
const PAUSES_BEFORE: ReadonlySet<string> = new Set(["、", "，", ",", ":", "：", "—"]);
const WORD_CHAR = /[\p{L}\p{N}]/u;
const SPACE = /\s/u;
const LATIN = /^[\p{Script=Latin}\s']+$/u;

export type FillerUse = { readonly start: number; readonly end: number; readonly matched: string };

const capitalised = (word: string): string => `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

/** Where the written form starts in text, as written or with a capital first letter (Um, at a sentence's head). */
const startsOf = (text: string, pattern: string): number[] =>
  [...new Set([pattern, capitalised(pattern)])].flatMap((form) => {
    const found: number[] = [];
    for (let at = text.indexOf(form); at !== -1; at = text.indexOf(form, at + 1)) found.push(at);
    return found;
  });

const pauseAfter = (rest: string, spaceCounts: boolean): boolean =>
  PAUSES_AFTER.some((pause) => rest.startsWith(pause)) || (spaceCounts && rest !== "" && SPACE.test(rest.charAt(0)));

/** Nothing but marks before it in the sentence, or a comma (or a speaker label's colon) right before it. */
const standsApartBefore = (before: string): boolean => {
  const trimmed = before.trimEnd();
  return !WORD_CHAR.test(trimmed) || PAUSES_BEFORE.has(trimmed.charAt(trimmed.length - 1));
};

/** A Latin word must not run into letters on either side: "umbrella" holds no "um". */
const wholeWord = (text: string, start: number, end: number): boolean => !WORD_CHAR.test(text.charAt(start - 1)) && !WORD_CHAR.test(text.charAt(end));

const counts = (text: string, entry: LexiconEntry, start: number): boolean => {
  const end = start + entry.pattern.length;
  const latin = LATIN.test(entry.pattern);
  if (latin && !wholeWord(text, start, end)) return false;
  const setOff = entry.group === SET_OFF;
  if (!pauseAfter(text.slice(end), !setOff)) return false;
  return !setOff || standsApartBefore(text.slice(0, start));
};

/** The fillers in one text, the longest where two start at the same place (えーと over えー). Positions are text's. */
export const fillerUses = (text: string, entries: readonly LexiconEntry[]): FillerUse[] => {
  const uses = entries.flatMap((entry) =>
    startsOf(text, entry.pattern)
      .filter((start) => counts(text, entry, start))
      .map((start) => ({ start, end: start + entry.pattern.length, matched: text.slice(start, start + entry.pattern.length) })),
  );
  const longest = new Map<number, FillerUse>();
  uses.forEach((use) => {
    const held = longest.get(use.start);
    if (held === undefined || held.end < use.end) longest.set(use.start, use);
  });
  return [...longest.values()].toSorted((left, right) => left.start - right.start);
};

type Hit = { readonly sentence: Sentence; readonly use: FillerUse; readonly offset: number };

/** The sentence text holds a blank where the source has markup; a word touching one is part of a styled word (**T**erm). */
const touchesMarkup = (source: string, sentence: Sentence, use: FillerUse): boolean =>
  [use.start - 1, use.end].some((at) => {
    const shown = sentence.text.charAt(at);
    return shown !== "" && SPACE.test(shown) && source.charAt(sentence.span.start + at) !== shown;
  });

const hitsIn = (source: string, sentence: Sentence, entries: readonly LexiconEntry[]): Hit[] => {
  const quoted: readonly Span[] = quotedIn(sentence, QUOTATION_MARKS);
  return fillerUses(sentence.text, entries)
    .filter((use) => !touchesMarkup(source, sentence, use))
    .map((use) => ({ sentence, use, offset: sentence.span.start + use.start }))
    .filter((hit) => !isWithinAny(quoted, { start: hit.offset, end: hit.offset + hit.use.matched.length }));
};

const findingOf = (hit: Hit, count: number, limit: number): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: hit.sentence.text.trim(),
  values: { matched: hit.use.matched, count, limit, offset: hit.offset },
});

const fillerHits = (doc: ProseDocument, entries: readonly LexiconEntry[]): Hit[] =>
  doc.sentences.filter((sentence) => sentence.embeddedLanguage === undefined).flatMap((sentence) => hitsIn(doc.source, sentence, entries));

/** Every filler once there are limit of them in the document. */
export const fillerWord: Detector = (doc, options): Finding[] => {
  const hits = fillerHits(doc, options.lexicon ?? []);
  return hits.length === 0 || hits.length < options.limit ? [] : hits.map((hit) => findingOf(hit, hits.length, options.limit));
};
