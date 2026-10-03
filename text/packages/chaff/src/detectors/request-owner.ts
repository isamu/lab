// A request for an action (「資料をご確認ください」 "Please send the report.") with no deadline and no person or role,
// in its own sentence or the next. The words come from the language's lexicons; the code only combines them.
import type { Detector, Finding, Lexicon, ProseDocument, Sentence, Span, StructureNode } from "../plugin.ts";
import { proseText } from "../measure.ts";
import { comparableWords } from "./lexicon-match.ts";
import { escapeRegExp } from "../orthography.ts";
import { inDocumentOrder } from "../structure/issues.ts";

/** The lexicons the rule reads, by name. A language without them checks nothing. */
export const REQUEST_LEXICONS = {
  ending: "request-ending",
  action: "request-action",
  condition: "request-condition",
  deadline: "request-deadline",
  owner: "request-owner",
  pointer: "request-pointer",
} as const;

type Words = Readonly<Record<keyof typeof REQUEST_LEXICONS, readonly string[]>>;

/** A clock time (14:00, 14時, 2pm) says when as much as a date does; a duration (3時間) does not. */
const CLOCK = /\d{1,2}\s*(?:[:：]\d{2}|時(?!間)|\s?[ap]\.?m\.?(?![a-z]))/iu;

const patternsOf = (lexicon: Lexicon | undefined): string[] => (lexicon ?? []).map((entry) => comparableWords(entry.pattern));

const wordsOf = (doc: ProseDocument): Words => ({
  ending: patternsOf(doc.lexicons[REQUEST_LEXICONS.ending]),
  action: patternsOf(doc.lexicons[REQUEST_LEXICONS.action]),
  condition: patternsOf(doc.lexicons[REQUEST_LEXICONS.condition]),
  deadline: patternsOf(doc.lexicons[REQUEST_LEXICONS.deadline]),
  owner: patternsOf(doc.lexicons[REQUEST_LEXICONS.owner]),
  pointer: patternsOf(doc.lexicons[REQUEST_LEXICONS.pointer]),
});

/** How far apart, in characters, the action word and the request ending may be: the action must be what is requested. */
const ACTION_REACH = 12;

/** A Latin word matches whole words only ("by" is not in "maybe"); other scripts have no spaces to bound a word. */
const matcherOf = (pattern: string): RegExp =>
  /^[\p{Script=Latin}\d]/u.test(pattern)
    ? new RegExp(`(?<![\\p{L}\\d])${escapeRegExp(pattern)}(?![\\p{L}\\d])`, "gu")
    : new RegExp(escapeRegExp(pattern), "gu");

type Place = { readonly start: number; readonly end: number };

/** Where the lexicon's words occur in the text (after the comparable form: lower case, straight apostrophes). */
const placesOf = (text: string, patterns: readonly string[]): Place[] => {
  const comparable = comparableWords(text);
  return patterns
    .filter((pattern) => pattern !== "")
    .flatMap((pattern) => [...comparable.matchAll(matcherOf(pattern))].map((match) => ({ start: match.index, end: match.index + match[0].length })));
};

export const containsAny = (text: string, patterns: readonly string[]): boolean => placesOf(text, patterns).length > 0;

const gapBetween = (left: Place, right: Place): number => Math.max(left.start - right.end, right.start - left.end, 0);

/**
 * A request for an action: an action word next to a request ending (「確認してください」「please send」), not a condition
 * (「ご不明な点があれば…ください」 is an offer), and not a pointer to where to read more (「詳細は資料をご確認ください」).
 * The action has to be close to the ending, or a noun like 検討会 or 履修登録 earlier in the sentence would make one.
 */
export const isRequest = (text: string, words: Words): boolean => {
  const endings = placesOf(text, words.ending);
  const asked = placesOf(text, words.action).some((action) => endings.some((ending) => gapBetween(action, ending) <= ACTION_REACH));
  return asked && !containsAny(text, words.condition) && !containsAny(text, words.pointer);
};

const NAMED = new Set(["PROPN"]);

/** A proper noun in the request itself (「Ito, please share」) names who; one in the next sentence may be a product or a place. */
const namesSomeone = (sentence: Sentence): boolean => (sentence.tokens ?? []).some((token) => NAMED.has(token.pos));

const datedWithin = (dates: readonly Span[], span: Span): boolean => dates.some((date) => date.start >= span.start && date.start < span.end);

type Bounds = { readonly starts: ReadonlySet<number>; readonly ends: ReadonlySet<number> };

/** Where the sentence's words start and end in its comparable text, found by walking the token surfaces in order. */
const wordBounds = (comparable: string, sentence: Sentence): Bounds | undefined => {
  const tokens = sentence.tokens;
  if (tokens === undefined || tokens.length === 0) return undefined;
  const starts = new Set<number>();
  const ends = new Set<number>();
  tokens.reduce((from, token) => {
    const surface = comparableWords(token.surface);
    const at = surface === "" ? -1 : comparable.indexOf(surface, from);
    if (at === -1) return from;
    starts.add(at);
    ends.add(at + surface.length);
    return at + surface.length;
  }, 0);
  return { starts, ends };
};

/**
 * Whether the sentence holds one of the words as whole words. With parts of speech a word must start and end on a word
 * boundary, so 様 is not found in 同様, さん in たくさん, or まで in いままで; without them, as text.
 */
const holdsWord = (sentence: Sentence, patterns: readonly string[]): boolean => {
  const comparable = comparableWords(proseText(sentence));
  const bounds = wordBounds(comparable, sentence);
  return placesOf(comparable, patterns).some((place) => bounds === undefined || (bounds.starts.has(place.start) && bounds.ends.has(place.end)));
};

/** Whether a sentence says when (a date, a clock time, a deadline word) or who (a role; a name in the request itself). */
const saysWhenOrWho = (sentence: Sentence, words: Words, dates: readonly Span[], isRequestItself: boolean): boolean =>
  datedWithin(dates, sentence.span) ||
  CLOCK.test(proseText(sentence)) ||
  holdsWord(sentence, words.deadline) ||
  holdsWord(sentence, words.owner) ||
  (isRequestItself && namesSomeone(sentence));

/** A paragraph break or a new list item between two sentences: the second does not continue the first. */
const BREAK = /\n[^\S\n]*\n|\n[^\S\n]*(?:[-*+]|\d+[.)])[^\S\n]/u;

const continues = (source: string, sentence: Sentence, next: Sentence | undefined): next is Sentence =>
  next !== undefined && !BREAK.test(source.slice(sentence.span.end, next.span.start));

const dateSpans = (tree: StructureNode | undefined): Span[] =>
  tree === undefined ? [] : inDocumentOrder(tree).flatMap((node) => (node.kind === "date" ? [node.span] : []));

/** The request sentences with neither a deadline nor a person in them or in the sentence after, in the same paragraph or item. */
export const ownerlessRequests = (doc: ProseDocument): Sentence[] => {
  const words = wordsOf(doc);
  const dates = dateSpans(doc.structure);
  return doc.sentences.filter((sentence, index) => {
    if (!isRequest(proseText(sentence), words) || saysWhenOrWho(sentence, words, dates, true)) return false;
    const next = doc.sentences[index + 1];
    return !continues(doc.source, sentence, next) || !saysWhenOrWho(next, words, dates, false);
  });
};

export const requestWithoutDeadline: Detector = (doc: ProseDocument): Finding[] =>
  ownerlessRequests(doc).map((sentence) => ({
    rule: "request-without-deadline",
    severity: "info",
    line: 0,
    column: 0,
    quote: proseText(sentence),
    values: { offset: sentence.span.start },
  }));
