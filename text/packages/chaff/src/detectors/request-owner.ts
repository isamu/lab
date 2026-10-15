// A request for an action (「資料をご確認ください」 "Please send the report.") with no deadline and no person or role,
// in its own sentence or the next. The words come from the language's lexicons; the code only combines them.
import type { Detector, Finding, Lexicon, ProseDocument, Section, Sentence, Span, StructureNode } from "../plugin.ts";
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
  offer: "request-offer",
  timing: "request-timing",
  invitation: "request-invitation",
  contact: "request-contact",
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
  offer: patternsOf(doc.lexicons[REQUEST_LEXICONS.offer]),
  timing: patternsOf(doc.lexicons[REQUEST_LEXICONS.timing]),
  invitation: patternsOf(doc.lexicons[REQUEST_LEXICONS.invitation]),
  contact: patternsOf(doc.lexicons[REQUEST_LEXICONS.contact]),
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

/** An invitation verb right at the request ending (「ご相談ください」 "please come"): the reader may come, nothing is to be finished. */
const INVITATION_REACH = 1;

/** A comma or semicolon between an action and the invitation: the action is a request of its own (「申請書を提出し、会場へお越しください」). */
const CLAUSE_BREAK = /[、，,;；]/u;

/** A label and a colon (「電話：」 "Fax:"): a contact line, whose request is how to reach the writer. */
const LABEL_COLON = /^\s*[:：]/u;

/** Whether the action is what the invitation is for (「登録をしにお越しください」「入力用にご使用ください」), not a request beside it. */
const invitedTo = (comparable: string, action: Place, invitation: Place): boolean => {
  const [left, right] = action.start <= invitation.start ? [action, invitation] : [invitation, action];
  return !CLAUSE_BREAK.test(comparable.slice(left.end, right.start));
};

const holdsContactLine = (text: string, words: Words): boolean => {
  const comparable = comparableWords(text);
  return placesOf(comparable, words.contact).some((label) => LABEL_COLON.test(comparable.slice(label.end)));
};

/**
 * A request for an action: an action word next to a request ending (「確認してください」「please send」), not a condition
 * (「ご不明な点があれば…ください」 is an offer), not an open offer to take the reader's questions (「ご質問はメールでお送りください」),
 * not a pointer to where to read more (「詳細は資料をご確認ください」), not what an invitation is for (「登録をしにお越しください」),
 * and not the way to reach the writer on a contact line (「ファックス番号：… 送信後、ご連絡ください」).
 * The action has to be close to the ending, or a noun like 検討会 or 履修登録 earlier in the sentence would make one.
 */
export const isRequest = (text: string, words: Words): boolean => {
  const comparable = comparableWords(text);
  const endings = placesOf(text, words.ending);
  const invitations = placesOf(text, words.invitation).filter((invitation) => endings.some((ending) => gapBetween(invitation, ending) <= INVITATION_REACH));
  const asked = placesOf(text, words.action).some(
    (action) =>
      endings.some((ending) => gapBetween(action, ending) <= ACTION_REACH) && !invitations.some((invitation) => invitedTo(comparable, action, invitation)),
  );
  if (!asked || holdsContactLine(text, words)) return false;
  return ![words.condition, words.offer, words.pointer].some((patterns) => containsAny(text, patterns));
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

/**
 * Whether a sentence says when or who (a role). The request itself may also say when relative to something else
 * (「提出いただく前に」 "before you submit") or name the person; the next sentence's timing or name may be about something else.
 */
const saysWhenOrWho = (sentence: Sentence, words: Words, dates: readonly Span[], isRequestItself: boolean): boolean =>
  datedWithin(dates, sentence.span) ||
  CLOCK.test(proseText(sentence)) ||
  holdsWord(sentence, words.deadline) ||
  holdsWord(sentence, words.owner) ||
  (isRequestItself && (holdsWord(sentence, words.timing) || namesSomeone(sentence)));

/** A paragraph break or a new list item between two sentences: the second does not continue the first. */
const BREAK = /\n[^\S\n]*\n|\n[^\S\n]*(?:[-*+]|\d+[.)])[^\S\n]/u;

const continues = (source: string, sentence: Sentence, next: Sentence | undefined): next is Sentence =>
  next !== undefined && !BREAK.test(source.slice(sentence.span.end, next.span.start));

const dateSpans = (tree: StructureNode | undefined): Span[] =>
  tree === undefined ? [] : inDocumentOrder(tree).flatMap((node) => (node.kind === "date" ? [node.span] : []));

/** A section's heading, read as a sentence so the deadline words match it the same way. */
const headingOf = (section: Section): Sentence => ({
  span: section.span,
  text: section.heading,
  ...(section.headingTokens === undefined ? {} : { tokens: section.headingTokens }),
});

/** The headings an offset sits under: its own section's, then each enclosing one's up to the title. */
const enclosingHeadings = (sections: readonly Section[], offset: number): Sentence[] => {
  const own = sections.findLastIndex((section) => section.span.start <= offset);
  const chain = sections
    .slice(0, own + 1)
    .reduceRight<{ depth: number; found: Section[] }>(
      (walk, section) => (section.depth < walk.depth ? { depth: section.depth, found: [...walk.found, section] } : walk),
      { depth: Number.POSITIVE_INFINITY, found: [] },
    ).found;
  return chain.filter((section) => section.depth > 0 && section.heading.trim() !== "").map(headingOf);
};

/**
 * A notice whose heading names its deadline (「見積提出期限：10月26日」「【随時受付】」): every request under it inherits it.
 * A date alone in a heading is more often the day the notice was issued or the event it announces, so it is not enough.
 */
const underDeadlineHeading = (sections: readonly Section[], sentence: Sentence, words: Words): boolean =>
  enclosingHeadings(sections, sentence.span.start).some((heading) => holdsWord(heading, words.deadline));

/** The request sentences with neither a deadline nor a person in them, in the sentence after (same paragraph or item), or in a heading above. */
export const ownerlessRequests = (doc: ProseDocument): Sentence[] => {
  const words = wordsOf(doc);
  const dates = dateSpans(doc.structure);
  return doc.sentences.filter((sentence, index) => {
    if (!isRequest(proseText(sentence), words) || saysWhenOrWho(sentence, words, dates, true)) return false;
    const next = doc.sentences[index + 1];
    if (continues(doc.source, sentence, next) && saysWhenOrWho(next, words, dates, false)) return false;
    return !underDeadlineHeading(doc.sections, sentence, words);
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
