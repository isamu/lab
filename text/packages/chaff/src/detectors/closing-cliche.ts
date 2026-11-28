import type { Detector, Finding, LexiconEntry, Paragraph, Sentence } from "../plugin.ts";
import { closingSentences } from "../closing-paragraph.ts";
import { entriesForGenre } from "../lexicon-genres.ts";
import { exhortationIn, exhortationWords } from "./closing-exhortation.ts";
import { comparableText, entryIn, entryOpens } from "./lexicon-match.ts";

// 定型の結び（いかがでしたか、Hope this helps、Happy brewing!）。語はどれも語彙表が持ち、ここは組み方だけを知る。語彙表の group:
//   なし                      結び（最後の節の終わりの段落）のどこかにあれば当たる言い回し
//   last                      最後の段落にあるときだけ当たる言い回し（てみてほしい）。本文の途中なら普通の勧め
//   lead:/open:/end:<name>    前の語と文の終わりの語の組（気軽に〜ください）。closing-exhortation と同じ書き方
//   signoff                   最後の段落の、この語で始まり「!」で終わる短い一行（Happy brewing!）
//   stacked                   結びにほかの定型があるときだけ当たる言い回し（feel free to）。一つなら普通の礼儀

const LAST = "last";
const SIGNOFF = "signoff";
const STACKED = "stacked";

/** 一行の結びの挨拶と読む語の数の上限。「Happy brewing!」は二語、「Happy holidays, everyone!」は三語。 */
const SIGNOFF_WORDS = 3;

const NOT_WORDS = new Set(["PUNCT", "SYM"]);

const wordCount = (sentence: Sentence): number =>
  sentence.tokens === undefined
    ? comparableText(sentence)
        .split(/\s+/u)
        .filter((word) => /\p{L}/u.test(word)).length
    : sentence.tokens.filter((token) => !NOT_WORDS.has(token.pos)).length;

const isSignoff = (sentence: Sentence, entry: LexiconEntry): boolean =>
  entryOpens(sentence, entry) && /[!！]$/u.test(comparableText(sentence).trimEnd()) && wordCount(sentence) <= SIGNOFF_WORDS;

/** 結びの最後の段落の文。結びの最後の文を含む段落から後ろ。 */
const lastParagraphSentences = (sentences: readonly Sentence[], paragraphs: readonly Paragraph[]): readonly Sentence[] => {
  const final = sentences.at(-1);
  if (final === undefined) return [];
  const paragraph = paragraphs.find((each) => each.span.start <= final.span.start && final.span.start < each.span.end);
  return paragraph === undefined ? [final] : sentences.filter((sentence) => sentence.span.start >= paragraph.span.start);
};

/** 段落全体が斜体（*…* か _…_）。本文の後ろに添える但し書き（*This article is not tax advice.*）の形。 */
const ITALIC_PARAGRAPH = /^([*_])(?!\1)[\s\S]*[^\s*_]\1$/u;

const isItalicNote = (source: string, paragraph: Paragraph): boolean => ITALIC_PARAGRAPH.test(source.slice(paragraph.span.start, paragraph.span.end).trim());

/**
 * 最後の段落の文に、後ろに続く斜体の但し書きを除いた最後の段落の文も加える。但し書きは書き手の結びではないので、
 * その前の段落が最後の一行として読まれる。
 */
const lastLineSentences = (sentences: readonly Sentence[], paragraphs: readonly Paragraph[], source: string): readonly Sentence[] => {
  const notes = new Set(paragraphs.filter((paragraph) => isItalicNote(source, paragraph)));
  const inNote = (sentence: Sentence): boolean => [...notes].some((note) => note.span.start <= sentence.span.start && sentence.span.start < note.span.end);
  const beforeNotes = sentences.slice(0, sentences.findLastIndex((sentence) => !inNote(sentence)) + 1);
  return [...lastParagraphSentences(sentences, paragraphs), ...lastParagraphSentences(beforeNotes, paragraphs)];
};

type Words = {
  readonly closing: ReturnType<typeof exhortationWords>;
  readonly last: readonly LexiconEntry[];
  readonly signoff: readonly LexiconEntry[];
  readonly stacked: readonly LexiconEntry[];
};

/** 最後の段落でだけ当たる語。言い回しなら語彙の語、挨拶の一行なら文そのもの。 */
const lastIn = (sentence: Sentence, words: Words): string | undefined =>
  words.last.find((entry) => entryIn(sentence, entry))?.pattern ??
  (words.signoff.some((entry) => isSignoff(sentence, entry)) ? sentence.text.trim() : undefined);

type Hit = { readonly sentence: Sentence; readonly matched: string };

/** 結びの、定型の言い回しのある文。一文に一つ。stacked の語は、ほかの定型が結びにあるときだけ数える。 */
export const closingClicheHits = (sentences: readonly Sentence[], paragraphs: readonly Paragraph[], words: Words, source = ""): Hit[] => {
  const last = new Set(lastLineSentences(sentences, paragraphs, source));
  const stock = new Map<Sentence, string>(
    sentences.flatMap((sentence): [Sentence, string][] => {
      const matched = exhortationIn(sentence, words.closing) ?? (last.has(sentence) ? lastIn(sentence, words) : undefined);
      return matched === undefined ? [] : [[sentence, matched]];
    }),
  );
  const stackedIn = (sentence: Sentence): string | undefined =>
    stock.size === 0 ? undefined : words.stacked.find((entry) => entryIn(sentence, entry))?.pattern;
  return sentences.flatMap((sentence) => {
    const matched = stock.get(sentence) ?? stackedIn(sentence);
    return matched === undefined ? [] : [{ sentence, matched }];
  });
};

export const closingClicheWords = (lexicon: readonly LexiconEntry[]): Words => ({
  closing: exhortationWords(lexicon),
  last: lexicon.filter((entry) => entry.group === LAST),
  signoff: lexicon.filter((entry) => entry.group === SIGNOFF),
  stacked: lexicon.filter((entry) => entry.group === STACKED),
});

/** 結び（最後の節の終わりの段落）の定型の言い回し。limit は指摘に要る文の数。 */
export const closingCliche: Detector = (doc, options): Finding[] => {
  const hits = closingClicheHits(
    closingSentences(doc.sections, doc.paragraphs),
    doc.paragraphs,
    closingClicheWords(entriesForGenre(options.lexicon ?? [], options.genre)),
    doc.source,
  );
  if (hits.length < options.limit) return [];
  return hits.map((hit) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { matched: hit.matched, count: hits.length, limit: options.limit, offset: hit.sentence.span.start },
  }));
};
