import type { BulletList, Detector, DetectorOptions, Finding, ProseDocument, Sentence, Span } from "../plugin.ts";
import { densityFindings } from "./ai-phrasing.ts";
import { endsWithColon } from "./lead-in.ts";

/** Between a lead-in and its list: only blank space. A thematic break (`***`) separates them; bold marks sit inside the sentence. */
const ONLY_BLANKS = /^\s*$/u;

/** How many sentences end at or before an offset. Sentences are in document order, so a binary search. */
const countEndingBy = (sentences: readonly Sentence[], offset: number): number => {
  const search = (low: number, high: number): number => {
    if (low >= high) return low;
    const middle = Math.floor((low + high) / 2);
    return (sentences[middle]?.span.end ?? Infinity) <= offset ? search(middle + 1, high) : search(low, middle);
  };
  return search(0, sentences.length);
};

/** The sentence that ends last before the list starts, if nothing but blanks lies between them. */
const sentenceRightBefore = (sentences: readonly Sentence[], list: BulletList, source: string): Sentence | undefined => {
  const before = sentences[countEndingBy(sentences, list.span.start) - 1];
  return before !== undefined && ONLY_BLANKS.test(source.slice(before.span.end, list.span.start)) ? before : undefined;
};

const insideAny = (spans: readonly Span[], offset: number): boolean => spans.some((span) => span.start <= offset && offset < span.end);

/** A label's words, without its colon and bold marks (**参考:** → 参考). */
const EMPHASIS = new Set(["*", "_"]);
const LABEL_END = /[\s*_:：]/u;

const labelWords = (text: string): string => {
  const chars = Array.from(text.trim());
  const start = chars.findIndex((char) => !EMPHASIS.has(char));
  const end = chars.findLastIndex((char) => !LABEL_END.test(char));
  return start === -1 || end < start ? "" : chars.slice(start, end + 1).join("");
};

/** A noun with no kana inflection (参考, 注意点): a name, not a sentence (以下の通りです) and not a lone symbol (⚠️). */
const NOUN_LABEL = /^(?=.*\p{L})[^\p{Script=Hiragana}]+$/u;

/** An English label is a name of a word or three (See also, Pros); past that it is a sentence (Here's what you need). */
const MAX_LABEL_WORDS = 3;

const isNounLabel = (words: string): boolean => NOUN_LABEL.test(words) && words.split(/\s+/u).length <= MAX_LABEL_WORDS;

/**
 * A field of an entry's template: the same noun label before the list of each entry (**参考:** before each entry's link).
 * It names the field the way a table's column does; it does not lead into anything.
 */
const fieldLabels = (leadIns: readonly Sentence[]): ReadonlySet<string> => {
  const counts = leadIns
    .map((sentence) => labelWords(sentence.text))
    .reduce((tally, words) => tally.set(words, (tally.get(words) ?? 0) + 1), new Map<string, number>());
  return new Set([...counts].filter(([words, count]) => count > 1 && isNounLabel(words)).map(([words]) => words));
};

/** A line that is only a bold label (**Pros:**, **参考**:), and the label inside the bold marks. */
const BOLD_LINE = /^(?:\*\*|__)(?<label>[^*_\n]+)(?:\*\*|__)[:：]?$/u;

const lineAround = (source: string, sentence: Sentence): string => {
  const end = source.indexOf("\n", sentence.span.end);
  return source.slice(source.lastIndexOf("\n", sentence.span.start - 1) + 1, end === -1 ? source.length : end);
};

/** A bold noun label on a line of its own names the list under it, as a heading does (**Pros:** then **Cons:**). */
const isBoldNounLabel = (sentence: Sentence, source: string): boolean => {
  const label = BOLD_LINE.exec(lineAround(source, sentence).trim())?.groups?.["label"];
  return label !== undefined && isNounLabel(labelWords(label));
};

/**
 * Prose sentences ending in a colon that hand the reader straight to a list (「以下の通りです：」, "Here's what you need:").
 * An item of a list is not prose: 「例: `code`」 ends in a colon once its code is masked, and it leads nowhere.
 */
export const colonLeadIns = (sentences: readonly Sentence[], lists: readonly BulletList[], listSpans: readonly Span[], source: string): Sentence[] => {
  const leadIns = lists.flatMap((list) => {
    const before = sentenceRightBefore(sentences, list, source);
    return before !== undefined && endsWithColon(before.text) && !insideAny(listSpans, before.span.start) ? [before] : [];
  });
  const fields = fieldLabels(leadIns);
  return leadIns.filter((sentence) => !fields.has(labelWords(sentence.text)) && !isBoldNounLabel(sentence, source));
};

/** Lead-ins in one or two sections are a how-to's procedure or a pair of lists; the rule's why is section after section. */
const DEFAULT_MIN_SECTIONS = 3;

const minSections = (options: DetectorOptions): number => {
  const value = options.settings?.["min_sections"];
  return typeof value === "number" ? value : DEFAULT_MIN_SECTIONS;
};

/** How many sections hold a lead-in. A document without headings cannot be split, so each lead-in counts as its own. */
const sectionsHolding = (doc: ProseDocument, leadIns: readonly Sentence[]): number => {
  if (!doc.sections.some((section) => section.depth > 0)) return leadIns.length;
  const sectionOf = (sentence: Sentence): number => doc.sections.findLastIndex((section) => section.span.start <= sentence.span.start);
  return new Set(leadIns.map(sectionOf)).size;
};

/**
 * コロンで箇条書きへ渡す文（以下の通りです：）。1 つなら案内だが、節ごとに続くと説明が箇条書きの前置きだけになる。
 * 数えるのは文書の言語の文だけ。和文の中の英文（Examples include:）は、英語ではふつうの書き方なので数えない。
 */
export const colonLeadIn: Detector = (doc, options): Finding[] => {
  const inDocumentLanguage = doc.sentences.filter((sentence) => sentence.embeddedLanguage === undefined);
  const leadIns = colonLeadIns(inDocumentLanguage, doc.lists, doc.listSpans, doc.source);
  if (sectionsHolding(doc, leadIns) < minSections(options)) return [];
  const hits = leadIns.map((sentence) => ({ sentence, matched: sentence.text.trim() }));
  return densityFindings(doc, hits, options.limit);
};
