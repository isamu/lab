// Whether the items of one bulleted list share a form: all phrases or all sentences, all opening with a verb or all with
// a noun. Pure; reads the item sentences' tokens. Which form is right is the writer's choice, so only the minority within
// one list is reported. です/ます against plain endings inside a list is no-mixed-desumasu's, not this.
import { minorityWithin } from "../orthography.ts";
import { isQuotedAt } from "./bold-label.ts";
import type { BulletList, Detector, Finding, ProseDocument, Sentence, Span, Token } from "../plugin.ts";

/** What an item is made of: a phrase or a sentence (ending), and the word it opens with (head, English only). */
export type Axis = "ending" | "head";

/** For each axis, the two forms. The first is the side minorityWithin calls true. */
export const FORMS: Readonly<Record<Axis, readonly [string, string]>> = { ending: ["phrase", "sentence"], head: ["verb", "noun"] };

const SKIPPED_AT_END = new Set(["PUNCT", "SYM", "X"]);
const NOMINAL = new Set(["NOUN", "PROPN", "NUM", "PRON"]);
const PREDICATE = new Set(["VERB", "AUX", "ADJ"]);
const NOUN_HEAD = new Set(["NOUN", "ADJ", "DET", "NUM", "PRON", "PROPN"]);
const SENTENCE_END = /[.!?。．！？]["'”’)）」』]*$/u;
const OPENING_BRACKETS = new Set(["(", "（", "[", "［", "【"]);
const CLOSING_BRACKETS = new Set([")", "）", "]", "］", "】"]);

/** A word the tagger only guessed at, or one that is also a verb (Design, Document): its form is not known. */
const isUnsure = (token: Token | undefined): boolean => token?.features?.["Guess"] === "Yes" || token?.features?.["AlsoVerb"] === "Yes";

/** A finite verb or auxiliary: an English item with one says something. A gerund or participle (Running, nested) does not. */
const isFiniteVerb = (token: Token): boolean => (token.pos === "VERB" || token.pos === "AUX") && !["Ger", "Part"].includes(token.features?.["VerbForm"] ?? "");

/** The tokens before a closing aside: 「健康診断書（3か月以内のもの）」 ends, for its form, at 健康診断書. */
const withoutClosingAside = (tokens: readonly Token[]): readonly Token[] => {
  const last = tokens.findLastIndex((token) => !SKIPPED_AT_END.has(token.pos) || CLOSING_BRACKETS.has(token.surface));
  if (last === -1 || !CLOSING_BRACKETS.has(tokens[last]?.surface ?? "")) return tokens;
  const open = tokens.findLastIndex((token, index) => index < last && OPENING_BRACKETS.has(token.surface));
  return open <= 0 ? tokens : tokens.slice(0, open);
};

/** Japanese: a predicate at the end (出します, 済ませる, 早い) is a sentence; a noun (月末, 確認すること) is a phrase. */
const japaneseEnding = (sentences: readonly Sentence[]): string | undefined => {
  if (sentences.length > 1) return "sentence";
  const last = withoutClosingAside(sentences[0]?.tokens ?? []).findLast((token) => !SKIPPED_AT_END.has(token.pos));
  if (last === undefined) return undefined;
  if (NOMINAL.has(last.pos)) return "phrase";
  return PREDICATE.has(last.pos) ? "sentence" : undefined;
};

/** English: a sentence closes with a full stop and has a finite verb; a phrase has neither, nor any verb at all. Anything between is not judged. */
const englishEnding = (sentences: readonly Sentence[]): string | undefined => {
  const tokens = sentences.flatMap((sentence) => sentence.tokens ?? []);
  if (tokens.length === 0) return undefined;
  const closed = SENTENCE_END.test(sentences.at(-1)?.text.trim() ?? "");
  if (sentences.length > 1 || (closed && tokens.some(isFiniteVerb))) return "sentence";
  const verbless = !tokens.some((token) => token.pos === "VERB" || token.pos === "AUX");
  return !closed && verbless && !isUnsure(tokens[0]) ? "phrase" : undefined;
};

/** English: the word an item opens with. Install and Running open with a verb; The, Fast and Docker with a noun phrase. */
/** Small words a title leaves in lower case (Terms of Service). */
const TITLE_SMALL_WORDS = new Set(["of", "and", "or", "the", "a", "an", "to", "for", "in", "on"]);

/** Every word capitalised (Cover Letter, Terms of Service): a name or a title, whose first word is not a verb whatever its tag. */
const isTitleCase = (text: string): boolean =>
  text
    .trim()
    .split(/\s+/u)
    .every((word) => TITLE_SMALL_WORDS.has(word) || /^\p{Lu}/u.test(word));

/** A determiner that opens an object (the, a, your): no noun phrase goes on from its head with one. */
const opensObject = (token: Token | undefined): boolean => token?.features?.["PronType"] === "Art" || token?.features?.["Poss"] === "Yes";

const AFTER_ADJECTIVE = new Set(["ADP", "PART"]);

/** A noun or adjective, or an ordinary word the tagger took for a name because it is capitalised (Toggle). */
const isNounOrAdjective = (token: Token): boolean =>
  token.pos === "NOUN" || token.pos === "ADJ" || (token.pos === "PROPN" && token.features?.["OrdinaryWord"] === "Yes");

/** A verb in the base form an instruction takes (describe), not a past or third-person form (described, describes). */
const isBaseVerb = (token: Token | undefined): boolean =>
  token?.pos === "VERB" && token.features?.["VerbForm"] === undefined && token.lemma === token.surface.toLowerCase();

/**
 * An -ed word the tagger left without VerbForm (decreased, agreed, unauthorized): like a participle, it may modify the noun
 * after it. Proceed and need end in -ed too but are their own base forms.
 */
const isPastForm = (token: Token): boolean =>
  token.pos === "VERB" &&
  token.features?.["VerbForm"] === undefined &&
  /ed$/iu.test(token.surface) &&
  (token.lemma !== token.surface.toLowerCase() || !/eed$/iu.test(token.surface));

/** An -s word read as a verb that the tagger could not take back to a base form (Revisions): a plural noun, misread. Discuss and Focus are verbs. */
const isMisreadPlural = (token: Token): boolean =>
  token.pos === "VERB" && token.features?.["VerbForm"] === undefined && /[^su]s$/iu.test(token.surface) && token.lemma === token.surface.toLowerCase();

/** Participles (Generated files) and gerunds (Recovering from illness) open noun phrases and duties alike, so neither form. */
const NEITHER_FORM_VERB = new Set(["Part", "Ger"]);

/** The head as the first word's tag gives it. */
const headFromTag = (first: Token): string | undefined => {
  if (isUnsure(first) || isPastForm(first) || isMisreadPlural(first)) return undefined;
  if (first.pos === "VERB") return NEITHER_FORM_VERB.has(first.features?.["VerbForm"] ?? "") ? undefined : "verb";
  return NOUN_HEAD.has(first.pos) ? "noun" : undefined;
};

/** What the head axis reads besides the item's own words: the adapter's word lists, and the nouns of the item's list. */
export type HeadContext = {
  /** Verbs the tagger does not know as verbs (click), from the adapter's instruction-verb word list. */
  readonly instructionVerbs: ReadonlySet<string>;
  /** Words that open an instruction or an adjective phrase (Secure the server, Secure configuration), from verb-or-adjective. */
  readonly verbOrAdjective: ReadonlySet<string>;
  /** The lemmas the tagger read as nouns anywhere in the item's list. */
  readonly nounsInList: ReadonlySet<string>;
};

export const NO_HEAD_CONTEXT: HeadContext = { instructionVerbs: new Set(), verbOrAdjective: new Set(), nounsInList: new Set() };

type HeadReading = "verb" | "noun" | "unjudged" | undefined;

/** Reads the head from the item's tokens, its first word at `at`; undefined leaves it to the next reader. */
type HeadReader = (tokens: readonly Token[], at: number, context: HeadContext) => HeadReading;

/** A subject and its verb in one word (you're, we've): the item opens with its subject, as "you love …" does. */
const SUBJECT_CONTRACTION = /^(?:i|you|we|they|he|she|it)['’]\p{L}+$/iu;

const subjectContraction: HeadReader = (tokens, at) => (SUBJECT_CONTRACTION.test(tokens[at]?.surface ?? "") ? "noun" : undefined);

/** Secure, Open: a verb before "the", "a" or "your" (Secure the server), else maybe an adjective (Secure configuration). */
const verbOrAdjective: HeadReader = (tokens, at, context) => {
  if (!context.verbOrAdjective.has(tokens[at]?.surface.toLowerCase() ?? "")) return undefined;
  return opensObject(tokens[at + 1]) ? "verb" : "unjudged";
};

/** A verb the tagger does not know. Before a common noun the word may head a compound (Click fraud, Scroll bar), so its tag decides. */
const instructionVerb: HeadReader = (tokens, at, context) =>
  context.instructionVerbs.has(tokens[at]?.surface.toLowerCase() ?? "") && tokens[at + 1]?.pos !== "NOUN" ? "verb" : undefined;

const isSeriesJoint = (token: Token): boolean => token.surface === "," || token.pos === "CCONJ";

/** The single words of a series the item opens with: "Scope, estimate and describe tasks" gives Scope, estimate, describe. */
const openingSeries = (tokens: readonly Token[], at: number): readonly Token[] => {
  const word = tokens[at];
  if (word === undefined) return [];
  const after = tokens.findIndex((token, index) => index > at && !isSeriesJoint(token));
  return after === -1 || after === at + 1 ? [word] : [word, ...openingSeries(tokens, after)];
};

/** A series one of whose later words is a verb in its base form (Instrument, monitor and profile): it is a series of verbs. */
const seriesOfVerbs: HeadReader = (tokens, at) => (openingSeries(tokens, at).slice(1).some(isBaseVerb) ? "verb" : undefined);

/**
 * The first two words overrule the first word's tag. "Open the console" and "Press the button" open with a verb. "Clean up
 * after closing" and "Bake in the oven" may open with a verb or an adjective phrase (Close to the station), and "Washing
 * machine space" with a compound noun or a gerund and its object (Washing dishes): neither is judged.
 */
const nextWord: HeadReader = (tokens, at) => {
  const first = tokens[at];
  // The word right after, punctuation included: in "Next, the candidate" the comma ends the opener.
  const next = tokens[at + 1];
  if (first === undefined) return undefined;
  if (isNounOrAdjective(first) && opensObject(next)) return "verb";
  if (first.pos === "ADJ" && AFTER_ADJECTIVE.has(next?.pos ?? "")) return "unjudged";
  return first.features?.["VerbForm"] === "Ger" && next?.pos === "NOUN" ? "unjudged" : undefined;
};

/** A verb that the same list uses as a noun (holiday pay … pay during your notice), with no object after it: either reading. */
const nounElsewhereInList: HeadReader = (tokens, at, context) => {
  const first = tokens[at];
  return first?.pos === "VERB" && context.nounsInList.has(first.lemma ?? "") && !opensObject(tokens[at + 1]) ? "unjudged" : undefined;
};

const HEAD_READERS: readonly HeadReader[] = [subjectContraction, verbOrAdjective, instructionVerb, seriesOfVerbs, nextWord, nounElsewhereInList];

const englishHead = (sentences: readonly Sentence[], context: HeadContext): string | undefined => {
  const tokens = sentences[0]?.tokens ?? [];
  const at = tokens.findIndex((token) => !SKIPPED_AT_END.has(token.pos));
  const first = tokens[at];
  if (at === -1 || first === undefined || isTitleCase(sentences[0]?.text ?? "")) return undefined;
  const reading = HEAD_READERS.reduce<HeadReading>((found, reader) => found ?? reader(tokens, at, context), undefined);
  if (reading === undefined) return headFromTag(first);
  return reading === "unjudged" ? undefined : reading;
};

/** An item's form on an axis, or undefined when its words do not tell. Japanese items have no head axis (the verb comes last). */
export const formOf = (axis: Axis, sentences: readonly Sentence[], language: string, context: HeadContext = NO_HEAD_CONTEXT): string | undefined => {
  if (language === "ja") return axis === "ending" ? japaneseEnding(sentences) : undefined;
  return axis === "ending" ? englishEnding(sentences) : englishHead(sentences, context);
};

const within = (inner: Span, outer: Span): boolean => inner.start >= outer.start && inner.end <= outer.end;

/** The item's own sentences: those in its span, less those of a list nested inside it. */
export const itemSentences = (doc: ProseDocument, item: Span): Sentence[] => {
  const nested = doc.lists.map((list) => list.span).filter((span) => span.start > item.start && within(span, item));
  return doc.sentences.filter((sentence) => within(sentence.span, item) && !nested.some((span) => within(sentence.span, span)));
};

type Item = { readonly sentences: readonly Sentence[]; readonly form: string };

const findingOf = (axis: Axis, item: Item, count: number, of: number, limit: number): Finding => {
  const first = item.sentences[0];
  return {
    rule: "list-item-form-mix",
    severity: "info",
    line: 0,
    column: 0,
    quote: first?.text.trim() ?? "",
    values: { written: first?.text.trim() ?? "", count, of, limit, offset: first?.span.start ?? 0 },
    variant: `${axis}-${item.form}`,
  };
};

const AXES: readonly Axis[] = ["ending", "head"];

/** An item that opens with a label and a colon (大倉さんの肌感：…, Last modified: …): a field and its value, not judged. */
const LABELLED = /^[^:：。.]{1,40}\s*[:：]\s*\S/u;

/** Code or a link in the item as written: chaff masks it out of the sentence, so the item's words are not all there. */
const CODE_OR_LINK = /`|\]\(|\]\[|https?:\/\//u;

/** An item ending like a clause of one running sentence (…conduct;, …、, …and): the list is one sentence split up. */
const RUNNING_ON = /(?:[;,、，]|\b(?:and|or))$/iu;

/** An item of one word (Resume, 例) is a name: either form would read it the same. */
const MIN_WORDS = 2;

const wordCount = (sentences: readonly Sentence[]): number =>
  sentences.flatMap((sentence) => sentence.tokens ?? []).filter((token) => !SKIPPED_AT_END.has(token.pos)).length;

const isJudged = (written: string, sentences: readonly Sentence[]): boolean => {
  const text = sentences.map((sentence) => sentence.text).join(" ");
  return wordCount(sentences) >= MIN_WORDS && !LABELLED.test(text.trim()) && !CODE_OR_LINK.test(written);
};

const runsOn = (sentences: readonly Sentence[]): boolean => RUNNING_ON.test(sentences.at(-1)?.text.trim() ?? "");

const wordsOf = (doc: ProseDocument, lexicon: string): ReadonlySet<string> =>
  new Set((doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern.toLowerCase()));

const headContext = (doc: ProseDocument, items: readonly (readonly Sentence[])[]): HeadContext => ({
  instructionVerbs: wordsOf(doc, "instruction-verb"),
  verbOrAdjective: wordsOf(doc, "verb-or-adjective"),
  nounsInList: new Set(
    items.flatMap((sentences) =>
      sentences.flatMap((sentence) => (sentence.tokens ?? []).flatMap((token) => (token.pos === "NOUN" && token.lemma !== undefined ? [token.lemma] : []))),
    ),
  ),
});

const listFindings = (doc: ProseDocument, list: BulletList, limit: number): Finding[] => {
  const sentencesOf = list.itemSpans.map((span) => itemSentences(doc, span));
  if (sentencesOf.some(runsOn)) return [];
  const judged = sentencesOf.filter((sentences, index) => {
    const span = list.itemSpans[index];
    return span !== undefined && isJudged(doc.source.slice(span.start, sentences.at(-1)?.span.end ?? span.end), sentences);
  });
  const context = headContext(doc, judged);
  return AXES.flatMap((axis) => {
    const items = judged.flatMap((sentences) => {
      const form = formOf(axis, sentences, doc.language, context);
      return form === undefined ? [] : [{ sentences, form }];
    });
    const odd = minorityWithin(items, (item) => item.form === FORMS[axis][0], limit);
    return odd.map((item) => findingOf(axis, item, odd.length, items.length, limit));
  });
};

/** Each list item whose form is the minority in its list, on each axis. A quoted list is someone else's words. */
export const listItemFormMix: Detector = (doc, options): Finding[] => {
  const findings = doc.lists.filter((list) => !isQuotedAt(doc.source, list.span.start)).flatMap((list) => listFindings(doc, list, options.limit));
  // The same item can be read in two lists (its own and one the parser nests it in); report it once.
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${String(finding.values["offset"])} ${finding.variant ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
