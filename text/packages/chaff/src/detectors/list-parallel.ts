// Whether the items of one bulleted list share a form: all phrases or all sentences, all opening with a verb or all with
// a noun. Pure; reads the item sentences' tokens. Which form is right is the writer's choice, so only the minority within
// one list is reported. です/ます against plain endings inside a list is no-mixed-desumasu's, not this.
import { minorityWithin } from "../orthography.ts";
import { isQuotedAt } from "./bold-label.ts";
import { endsAsHeadline, markOrSkipped, withoutFootnoteReference, withoutTrailingMarks } from "./list-item-ending.ts";
import type { BulletList, Detector, Finding, ProseDocument, Sentence, Span, Token } from "../plugin.ts";
import { isLinkLabel } from "./link-label.ts";
import { itemLayout } from "./list-layout.ts";

/** What an item is made of: a phrase or a sentence (ending), and the word it opens with (head, English only). */
export type Axis = "ending" | "head";

/** For each axis, the two forms. The first is the side minorityWithin calls true. */
export const FORMS: Readonly<Record<Axis, readonly [string, string]>> = { ending: ["phrase", "sentence"], head: ["verb", "noun"] };

const SKIPPED_AT_END = new Set(["PUNCT", "SYM", "X"]);
const isMark = markOrSkipped(SKIPPED_AT_END);
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
  const open = tokens.findLastIndex((token, index) => index < last && OPENING_BRACKETS.has(token.surface.charAt(0)));
  return open <= 0 ? tokens : tokens.slice(0, open);
};

// Right after the last word, past closing quotes and an aside (すること（別紙）。): a question mark or a full stop.
const QUESTION_AFTER = /^[」』"”]*(?:[（(][^）)]*[）)])?[？?]/u;
const FULL_STOP_AFTER = /^[」』"”]*(?:[（(][^）)]*[）)])?[。．]/u;
const KOTO = "こと";
/** The negative (しないこと) and the copula's ある (であること) before こと. */
const INSTRUCTED_AUX = new Set(["ない", "ある"]);

/** A verb's plain form or its negative before こと (すること, しないこと); not a past (したこと) or な (大事なこと). */
const isInstructedAct = (token: Token | undefined): boolean => token?.pos === "VERB" || (token?.pos === "AUX" && INSTRUCTED_AUX.has(token.surface));

/** A dash standing apart before a label at the item's end (― 千葉市, – Culver City). */
const LABEL_DASH = /(?:^|\s)[―—–]\s/u;

/**
 * The sentences whose form is the item's. Several sentences make a sentence, unless the last one holds a dash and a
 * label: a title holding its own mark, then the label (やはり俺の青春ラブコメはまちがっている。 ― 千葉市, 走れ!メロス ― 三鷹市,
 * Jeopardy! – Culver City). The mark split the title, and the label ends the item.
 */
const ownEnding = (sentences: readonly Sentence[]): readonly Sentence[] =>
  sentences.length > 1 && LABEL_DASH.test(sentences.at(-1)?.text.trim() ?? "") ? sentences.slice(-1) : sentences;

/**
 * 〜すること。 / 〜しないこと。 with its full stop: the instruction or requirement form of official Japanese. It sits in a list of
 * sentences (〜しない。) as in a list of phrases (〜の確認), so it is read as neither, as no-mixed-desumasu reads こと.
 */
const isInstruction = (words: readonly Token[], after: string): boolean =>
  words.at(-1)?.surface === KOTO && isInstructedAct(words.at(-2)) && FULL_STOP_AFTER.test(after);

/**
 * One Japanese sentence: a predicate at the end (出します, 済ませる, 早い) or a question (大丈夫？) is a sentence; a noun (月末,
 * 確認すること) or a headline's あり / なし after a noun (翻訳あり) is a phrase; an instruction ending in こと。 is neither. Marks
 * after the last word (!!, a footnote reference) are not words.
 */
const japaneseSentenceEnding = (sentence: Sentence | undefined, headlineEndings: ReadonlySet<string>): string | undefined => {
  const words = withoutTrailingMarks(withoutClosingAside(withoutFootnoteReference(sentence?.tokens ?? [], isMark)), isMark);
  const last = words.at(-1);
  if (sentence === undefined || last === undefined) return undefined;
  const after = sentence.text.slice(last.span.end - sentence.span.start);
  if (isInstruction(words, after)) return undefined;
  if (QUESTION_AFTER.test(after)) return "sentence";
  if (NOMINAL.has(last.pos) || endsAsHeadline(words, headlineEndings)) return "phrase";
  return PREDICATE.has(last.pos) ? "sentence" : undefined;
};

const NAME_PARTS = new Set(["NOUN", "PROPN", "NUM", ...SKIPPED_AT_END]);
const MIN_NAME_WORDS = 2;

/**
 * Nouns alone, with no particle or verb between them (消費者庁リコール情報サイト, 記載例（手続補正書）, 聖地巡礼/ラブライブ!シリーズ): the
 * name of a page, a form or a work, as a link's words are. It reads as a phrase, but its form is not the writer's to align.
 */
const isName = (item: readonly Token[]): boolean => {
  const tokens = withoutClosingAside(item);
  const words = tokens.filter((token) => !SKIPPED_AT_END.has(token.pos));
  // A verbal noun last (各種ライブラリ更新, 不具合修正) names an act done: a phrase.
  const act = words.at(-1)?.features?.["VerbForm"] === "Vnoun";
  return words.length >= MIN_NAME_WORDS && !act && tokens.every((token) => NAME_PARTS.has(token.pos));
};

/** The form of an item that is a name: counted with the phrases, never reported. */
export const NAME = "name";

/** A sentence that ends at a mark a name may hold (ラブライブ!), not at a full stop. */
const splitInName = (sentence: Sentence): boolean => /[!?！？]$/u.test(sentence.text.trim());

/**
 * Japanese: an item that is a name is a name; one that opens with a name and goes on in sentences (a term and its gloss,
 * ステータスメッセージ。ステータスコードの…; an author and a title) is neither form; else an item of several sentences is a
 * sentence (ownEnding aside), and one sentence is read by its ending.
 */
const japaneseEnding = (item: readonly Sentence[], headlineEndings: ReadonlySet<string>): string | undefined => {
  const sentences = ownEnding(item);
  if (isName(item.flatMap((sentence) => sentence.tokens ?? [])) && item.slice(0, -1).every(splitInName)) return NAME;
  if (isName(item[0]?.tokens ?? [])) return undefined;
  return sentences.length > 1 ? "sentence" : japaneseSentenceEnding(sentences[0], headlineEndings);
};

/** English: a sentence closes with a full stop and has a finite verb; a phrase has neither, nor any verb at all. Anything between is not judged. */
const englishEnding = (item: readonly Sentence[]): string | undefined => {
  const sentences = ownEnding(item);
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

/** What the axes read besides the item's own words: the adapter's word lists, and the nouns of the item's list. */
export type HeadContext = {
  /** Verbs the tagger does not know as verbs (click), from the adapter's instruction-verb word list. */
  readonly instructionVerbs: ReadonlySet<string>;
  /** Words that open an instruction or an adjective phrase (Secure the server, Secure configuration), from verb-or-adjective. */
  readonly verbOrAdjective: ReadonlySet<string>;
  /** The lemmas the tagger read as nouns anywhere in the item's list. */
  readonly nounsInList: ReadonlySet<string>;
  /** Words that end a Japanese item as a headline does after a noun (翻訳あり), from headline-ending. */
  readonly headlineEndings: ReadonlySet<string>;
  /** Pronouns that open a clause (you, we), from subject-pronoun. */
  readonly subjectPronouns: ReadonlySet<string>;
  /** Words that open a prohibition before a noun (No calls), from prohibition-opener. */
  readonly prohibitionOpeners: ReadonlySet<string>;
};

export const NO_HEAD_CONTEXT: HeadContext = {
  instructionVerbs: new Set(),
  verbOrAdjective: new Set(),
  nounsInList: new Set(),
  headlineEndings: new Set(),
  subjectPronouns: new Set(),
  prohibitionOpeners: new Set(),
};

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

/** No calls, No food in the lab: a prohibition, as much a rule as "Never feed animals". Neither form. */
const prohibition: HeadReader = (tokens, at, context) => (context.prohibitionOpeners.has(tokens[at]?.surface.toLowerCase() ?? "") ? "unjudged" : undefined);

const HYPHEN = new Set(["-", "‐"]);

/**
 * Two words joined by a hyphen at the head: before a noun, a compound adjective (Run-on sentences, Self-managed
 * installs); before "the", "a" or "your", a compound verb (Double-click the icon). Otherwise either.
 */
const hyphenCompound: HeadReader = (tokens, at) => {
  const [first, hyphen, second, after] = [tokens[at], tokens[at + 1], tokens[at + 2], tokens[at + 3]];
  if (first === undefined || hyphen === undefined || second === undefined || !HYPHEN.has(hyphen.surface)) return undefined;
  if (first.span.end !== hyphen.span.start || hyphen.span.end !== second.span.start) return undefined;
  if (opensObject(after)) return "verb";
  return after?.pos === "NOUN" ? "noun" : "unjudged";
};

const HEAD_READERS: readonly HeadReader[] = [
  subjectContraction,
  prohibition,
  hyphenCompound,
  verbOrAdjective,
  instructionVerb,
  seriesOfVerbs,
  nextWord,
  nounElsewhereInList,
];

const headAt = (tokens: readonly Token[], at: number, context: HeadContext): string | undefined => {
  const first = tokens[at];
  if (first === undefined) return undefined;
  const reading = HEAD_READERS.reduce<HeadReading>((found, reader) => found ?? reader(tokens, at, context), undefined);
  if (reading === undefined) return headFromTag(first);
  return reading === "unjudged" ? undefined : reading;
};

/** A subject pronoun as written in running text: "IT" in capitals is an acronym (IT issues), "I" is the pronoun. */
const isSubjectPronoun = (token: Token, context: HeadContext): boolean =>
  context.subjectPronouns.has(token.surface.toLowerCase()) && (token.surface.length === 1 || token.surface !== token.surface.toUpperCase());

/**
 * Where an instruction starts after an opening clause with its own subject and verb, closed by a comma: "Next time you
 * log in, let the manager save it" opens, as an item, with "let". -1 when there is no such opener.
 */
const instructionAfterOpener = (tokens: readonly Token[], at: number, context: HeadContext): number => {
  const comma = tokens.findIndex((token, index) => index > at && token.surface === ",");
  const verbFollows = (index: number): boolean => {
    const next = tokens[index + 1];
    return next !== undefined && isFiniteVerb(next);
  };
  const first = tokens[at];
  // An item that opens with a subject or a verb (We do X when we …, get …) opens with its main clause.
  const opensMain = first === undefined || isSubjectPronoun(first, context) || isFiniteVerb(first);
  const clause = !opensMain && tokens.some((token, index) => index > at && index < comma && isSubjectPronoun(token, context) && verbFollows(index));
  return clause && headAt(tokens, comma + 1, context) === "verb" ? comma + 1 : -1;
};

/** A question (Do you have …?, What is …?) opens with its question form, neither an instruction nor a noun phrase. */
const isQuestion = (sentence: Sentence | undefined): boolean => /\?["'”’)]*$/u.test(sentence?.text.trim() ?? "");

const englishHead = (sentences: readonly Sentence[], context: HeadContext): string | undefined => {
  const tokens = sentences[0]?.tokens ?? [];
  const at = tokens.findIndex((token) => !SKIPPED_AT_END.has(token.pos));
  if (at === -1 || isTitleCase(sentences[0]?.text ?? "") || isQuestion(sentences[0])) return undefined;
  const instruction = instructionAfterOpener(tokens, at, context);
  return headAt(tokens, instruction === -1 ? at : instruction, context);
};

/** An item's form on an axis, or undefined when its words do not tell. Japanese items have no head axis (the verb comes last). */
/** An item that ends in a colon (Other kinds of decisions:) leads into what follows it: its ending is not its own, its opening still is. */
const LEAD_IN = /[:：]$/u;

const leadsIn = (sentences: readonly Sentence[]): boolean => LEAD_IN.test(sentences.at(-1)?.text.trim() ?? "");

export const formOf = (axis: Axis, sentences: readonly Sentence[], language: string, context: HeadContext = NO_HEAD_CONTEXT): string | undefined => {
  if (axis === "ending" && leadsIn(sentences)) return undefined;
  if (language === "ja") return axis === "ending" ? japaneseEnding(sentences, context.headlineEndings) : undefined;
  return axis === "ending" ? englishEnding(sentences) : englishHead(sentences, context);
};

const within = (inner: Span, outer: Span): boolean => inner.start >= outer.start && inner.end <= outer.end;

/** The item's own sentences: those in its span, less those of a list nested inside it. */
export const itemSentences = (doc: ProseDocument, item: Span): Sentence[] => {
  const nested = doc.lists.map((list) => list.span).filter((span) => span.start > item.start && within(span, item));
  return doc.sentences.filter((sentence) => within(sentence.span, item) && !nested.some((span) => within(sentence.span, span)));
};

/**
 * Where an item's own words end: before a line in it that opens, unindented, with a note lead (※応募書類は返却できません。,
 * "Note: …"). Markdown reads such a line as the last item's, but the note is about the whole list.
 */
export const itemOwnEnd = (source: string, item: Span, noteLeads: readonly string[]): number => {
  const lineStarts = [...source.slice(item.start, item.end).matchAll(/\n/gu)].map((match) => item.start + match.index + 1);
  const noteLine = lineStarts.find((start) => noteLeads.some((lead) => lead !== "" && source.startsWith(lead, start)));
  return noteLine === undefined ? item.end : noteLine - 1;
};

/** The sentence up to `end`: a note line under the item is not part of the item's last sentence. */
const cutAt = (sentence: Sentence, end: number, source: string): Sentence =>
  sentence.span.end <= end
    ? sentence
    : {
        ...sentence,
        span: { start: sentence.span.start, end },
        text: source.slice(sentence.span.start, end),
        ...(sentence.tokens === undefined ? {} : { tokens: sentence.tokens.filter((token) => token.span.end <= end) }),
      };

/** The item's own sentences, up to a note line under it. */
const ownSentences = (doc: ProseDocument, item: Span, noteLeads: readonly string[]): Sentence[] => {
  const end = itemOwnEnd(doc.source, item, noteLeads);
  return itemSentences(doc, item).flatMap((sentence) => (sentence.span.start < end ? [cutAt(sentence, end, doc.source)] : []));
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

/**
 * A list whose every item is a paragraph of several sentences (a stop on a walk, one per item) is prose cut into
 * bullets: how a paragraph opens is not a list form, so the head axis does not read it.
 */
const axesOf = (items: readonly (readonly Sentence[])[]): readonly Axis[] =>
  items.every((sentences) => sentences.length > 1) ? AXES.filter((axis) => axis !== "head") : AXES;

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
  headlineEndings: wordsOf(doc, "headline-ending"),
  subjectPronouns: wordsOf(doc, "subject-pronoun"),
  prohibitionOpeners: wordsOf(doc, "prohibition-opener"),
  nounsInList: new Set(
    items.flatMap((sentences) =>
      sentences.flatMap((sentence) => (sentence.tokens ?? []).flatMap((token) => (token.pos === "NOUN" && token.lemma !== undefined ? [token.lemma] : []))),
    ),
  ),
});

const listFindings = (doc: ProseDocument, list: BulletList, limit: number): Finding[] => {
  const layout = itemLayout(doc.source, list.itemSpans);
  return layout.groups.flatMap((spans) => groupFindings(doc, spans, layout.heads, limit));
};

/** A phrase heading a run of items (- 使用する際の注意ポイント): the heading of a flattened nested list, not one of its items. */
const isGroupLabel = (sentences: readonly Sentence[], language: string): boolean =>
  [FORMS.ending[0], NAME].includes(formOf("ending", sentences, language) ?? "");

const groupFindings = (doc: ProseDocument, itemSpans: readonly Span[], heads: readonly Span[], limit: number): Finding[] => {
  const noteLeads = (doc.lexicons["list-note-lead"] ?? []).map((entry) => entry.pattern);
  const linkEndings = (doc.lexicons["link-label-ending"] ?? []).map((entry) => entry.pattern);
  const sentencesOf = itemSpans.map((span) => ownSentences(doc, span, noteLeads));
  if (sentencesOf.some(runsOn)) return [];
  const judged = sentencesOf.filter((sentences, index) => {
    const span = itemSpans[index];
    if (span === undefined) return false;
    const written = doc.source.slice(span.start, sentences.at(-1)?.span.end ?? span.end);
    return isJudged(written, sentences) && !isLinkLabel(written, linkEndings) && !(heads.includes(span) && isGroupLabel(sentences, doc.language));
  });
  const context = headContext(doc, judged);
  return axesOf(judged).flatMap((axis) => {
    const items = judged.flatMap((sentences) => {
      const form = formOf(axis, sentences, doc.language, context);
      return form === undefined ? [] : [{ sentences, form }];
    });
    const odd = minorityWithin(items, (item) => (item.form === NAME ? FORMS.ending[0] : item.form) === FORMS[axis][0], limit);
    return odd.filter((item) => item.form !== NAME).map((item) => findingOf(axis, item, odd.length, items.length, limit));
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
