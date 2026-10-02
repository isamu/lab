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

const englishHead = (sentences: readonly Sentence[]): string | undefined => {
  const first = (sentences[0]?.tokens ?? []).find((token) => !SKIPPED_AT_END.has(token.pos));
  if (first === undefined || isUnsure(first) || isTitleCase(sentences[0]?.text ?? "")) return undefined;
  // A participle (Generated files, Nested lists) modifies the noun after it; the item is a noun phrase, but the tag does not say so.
  if (first.pos === "VERB") return first.features?.["VerbForm"] === "Part" ? undefined : "verb";
  return NOUN_HEAD.has(first.pos) ? "noun" : undefined;
};

/** An item's form on an axis, or undefined when its words do not tell. Japanese items have no head axis (the verb comes last). */
export const formOf = (axis: Axis, sentences: readonly Sentence[], language: string): string | undefined => {
  if (language === "ja") return axis === "ending" ? japaneseEnding(sentences) : undefined;
  return axis === "ending" ? englishEnding(sentences) : englishHead(sentences);
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

const listFindings = (doc: ProseDocument, list: BulletList, limit: number): Finding[] => {
  const sentencesOf = list.itemSpans.map((span) => itemSentences(doc, span));
  if (sentencesOf.some(runsOn)) return [];
  const judged = sentencesOf.filter((sentences, index) => {
    const span = list.itemSpans[index];
    return span !== undefined && isJudged(doc.source.slice(span.start, sentences.at(-1)?.span.end ?? span.end), sentences);
  });
  return AXES.flatMap((axis) => {
    const items = judged.flatMap((sentences) => {
      const form = formOf(axis, sentences, doc.language);
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
