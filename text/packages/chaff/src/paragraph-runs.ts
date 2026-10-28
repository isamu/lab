// Runs of one-sentence paragraphs: paragraphs that follow one another with nothing but blank lines between them, each holding a
// single sentence. Pure: paragraphs and the source they are cut from come in.
import type { Paragraph, Span } from "./plugin.ts";

/** A line break, then nothing but spaces (an ideographic space too), then another line break. */
const BLANK_LINE = /\n[^\S\n]*\n/u;

/**
 * Whether two paragraphs follow one another across a blank line and nothing else: no heading, list, table or code block between.
 * Lines joined by a single line break are one paragraph to Markdown, however the document builder splits them.
 */
const isAdjacent = (source: string, before: Paragraph, after: Paragraph): boolean => {
  const between = source.slice(before.span.end, after.span.start);
  return between.trim() === "" && BLANK_LINE.test(between);
};

/** A sentence's last mark, past closing quotes, brackets and emphasis marks. */
const SENTENCE_END = /[。．.!?！？]["'”’」』)）\]］}｝】》〕〉〛*_]*$/u;

/**
 * Whether a paragraph ends as a sentence does. One that does not is a label, a field, a line of a flattened table or a heading
 * written as plain text (日時：, Authors, 490 Ratings), which sets nothing apart.
 */
export const endsAsSentence = (source: string, paragraph: Paragraph): boolean =>
  SENTENCE_END.test(source.slice(paragraph.span.start, paragraph.span.end).trim());

/**
 * A mark a paragraph opens with to set itself out as an item (○ a case, ・ a point, ※ a note). A run of such paragraphs is a
 * list the writer marked by hand, not prose split into one-sentence paragraphs. A doubled mark (○○県, ○●) stands for a name.
 */
const ITEM_MARK = /^[ \t\u3000]*[○◯◎●・•■□◆◇▪▫★☆▶►➢✓※＊](?![○◯◎●・•■□◆◇▪▫★☆▶►➢✓※＊])/u;

/** A speaker's mark in minutes (○委員長（石井章君）\u3000…): it opens a turn of speech, which is prose. */
const SPEAKER_MARK = /^[ \t\u3000]*[○◯〇][^\s（）()、。，．「」『』:：]{1,20}(?:（[^）\n]{0,40}）)?\u3000/u;

/** Whether a paragraph opens with an item mark rather than a speaker's mark. */
export const opensAsItem = (source: string, paragraph: Paragraph): boolean => {
  const text = source.slice(paragraph.span.start, paragraph.span.end);
  return ITEM_MARK.test(text) && !SPEAKER_MARK.test(text);
};

/**
 * A reference list's entry label before its text ([7], [RFC2119], [WEB-ORIGIN]). Entries set one per paragraph are a list
 * written as plain text, not prose split into one-sentence paragraphs.
 */
const REFERENCE_LABEL = /^\s*\[[^\]\s]{1,32}\]\s/u;

/** Whether a paragraph is an entry of a reference list: inside one found by its heading, or opening with an entry label. */
export const isReferenceEntry = (source: string, paragraph: Paragraph, referenceLists: readonly Span[]): boolean =>
  REFERENCE_LABEL.test(source.slice(paragraph.span.start, paragraph.span.end)) ||
  referenceLists.some((list) => list.start <= paragraph.span.start && paragraph.span.start < list.end);

/**
 * An enumerator a paragraph opens with: (1), （2）, (iii), (a), ① . Paragraphs numbered this way are the items of a list
 * written as plain text, as a glossary's terms or an appendix's categories are.
 */
const BRACKETED_LABEL = /^[ \t\u3000]*[(（]([^)）\s]{1,6})[)）]/u;
const CIRCLED_NUMBER = /^[ \t\u3000]*[①-⑳]/u;
const ENUMERATOR_LABEL = /^(?:\d{1,3}|[０-９]{1,3}|[ivxlc]{1,6}|[IVXLC]{1,6}|[a-zA-Z]|[一二三四五六七八九十]{1,3})$/u;

const opensWithEnumerator = (source: string, paragraph: Paragraph): boolean => {
  const text = source.slice(paragraph.span.start, paragraph.span.end);
  return CIRCLED_NUMBER.test(text) || ENUMERATOR_LABEL.test(BRACKETED_LABEL.exec(text)?.[1] ?? "");
};

/** A lead-in's last mark: the paragraph announces what follows (Follow these steps:, 次のとおりです：). */
const LEAD_IN_END = /[:：]$/u;

/** How many sentences an item under a lead-in may hold before the paragraphs read as prose again. */
const MAX_ITEM_SENTENCES = 2;

/**
 * The paragraphs that follow a lead-in ending with a colon, adjacent to it and to one another, each short enough to be an item.
 * A list converted from HTML often loses its markup and keeps only its lead-in; its items are not prose split into paragraphs.
 */
const underLeadIn = (source: string, paragraphs: readonly Paragraph[]): ReadonlySet<Paragraph> => {
  const items = new Set<Paragraph>();
  paragraphs.reduce<Paragraph | undefined>((open, paragraph, at) => {
    const previous = paragraphs[at - 1];
    const continues =
      open !== undefined && previous !== undefined && isAdjacent(source, previous, paragraph) && paragraph.sentences.length <= MAX_ITEM_SENTENCES;
    if (continues) items.add(paragraph);
    if (LEAD_IN_END.test(source.slice(paragraph.span.start, paragraph.span.end).trim())) return paragraph;
    return continues ? open : undefined;
  }, undefined);
  return items;
};

/** Whether a paragraph can be counted in a run: one sentence, ending as a sentence, not an item or a reference entry. */
const counts = (source: string, paragraph: Paragraph, referenceLists: readonly Span[], leadInItems: ReadonlySet<Paragraph>): boolean =>
  paragraph.sentences.length === 1 &&
  endsAsSentence(source, paragraph) &&
  !opensAsItem(source, paragraph) &&
  !opensWithEnumerator(source, paragraph) &&
  !leadInItems.has(paragraph) &&
  !isReferenceEntry(source, paragraph, referenceLists);

/** How many opening words every paragraph of a run must share for the run to be a list of parallel entries. */
const PARALLEL_WORDS = 3;

const openingOf = (source: string, paragraph: Paragraph): string =>
  source.slice(paragraph.span.start, paragraph.span.end).trim().split(/\s+/u).slice(0, PARALLEL_WORDS).join(" ").toLowerCase();

/**
 * Whether every paragraph of a run opens with the same words (The government's 'How to … guide, one per guide): entries set
 * out in one frame, a list in all but markup. Text written without spaces between words never shares a whole opening.
 */
const isParallel = (source: string, run: readonly Paragraph[]): boolean => {
  const openings = run.map((paragraph) => openingOf(source, paragraph));
  const first = openings[0];
  return run.length > 1 && first !== undefined && first.split(" ").length === PARALLEL_WORDS && openings.every((opening) => opening === first);
};

/**
 * Each run of adjacent one-sentence paragraphs, in document order, as the paragraphs it holds. A paragraph of two sentences or
 * more, a paragraph that does not end as a sentence, opens with an item mark or an enumerator, follows a lead-in as its item or
 * is a reference list's entry, or anything between two paragraphs, ends the run. A run of parallel entries is a list, not a run.
 */
export const oneSentenceRuns = (source: string, paragraphs: readonly Paragraph[], referenceLists: readonly Span[] = []): Paragraph[][] => {
  const leadInItems = underLeadIn(source, paragraphs);
  return paragraphs
    .reduce<Paragraph[][]>((runs, paragraph, at) => {
      if (!counts(source, paragraph, referenceLists, leadInItems)) return runs;
      const previous = paragraphs[at - 1];
      const current = runs.at(-1);
      const continues = previous !== undefined && current?.at(-1) === previous && isAdjacent(source, previous, paragraph);
      if (continues) current.push(paragraph);
      else runs.push([paragraph]);
      return runs;
    }, [])
    .filter((run) => !isParallel(source, run));
};
