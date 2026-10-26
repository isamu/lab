import type { Detector, Finding, LexiconEntry, Paragraph, Sentence } from "../plugin.ts";
import { closingSentences } from "../closing-paragraph.ts";
import { exhortationIn, exhortationWords } from "./closing-exhortation.ts";
import { comparableText, entryIn, entryOpens } from "./lexicon-match.ts";

// 定型の結び（いかがでしたか、Hope this helps、Happy brewing!）。語はどれも語彙表が持ち、ここは組み方だけを知る。語彙表の group:
//   なし                      結び（最後の節の終わりの段落）のどこかにあれば当たる言い回し
//   last                      最後の段落にあるときだけ当たる言い回し（てみてほしい）。本文の途中なら普通の勧め
//   lead:/open:/end:<name>    前の語と文の終わりの語の組（気軽に〜ください）。closing-exhortation と同じ書き方
//   signoff                   最後の段落の、この語で始まり「!」で終わる短い一行（Happy brewing!）

const LAST = "last";
const SIGNOFF = "signoff";

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

type Words = { readonly closing: ReturnType<typeof exhortationWords>; readonly last: readonly LexiconEntry[]; readonly signoff: readonly LexiconEntry[] };

/** 最後の段落でだけ当たる語。言い回しなら語彙の語、挨拶の一行なら文そのもの。 */
const lastIn = (sentence: Sentence, words: Words): string | undefined =>
  words.last.find((entry) => entryIn(sentence, entry))?.pattern ??
  (words.signoff.some((entry) => isSignoff(sentence, entry)) ? sentence.text.trim() : undefined);

type Hit = { readonly sentence: Sentence; readonly matched: string };

/** 結びの、定型の言い回しのある文。一文に一つ。 */
export const closingClicheHits = (sentences: readonly Sentence[], paragraphs: readonly Paragraph[], words: Words): Hit[] => {
  const last = new Set(lastParagraphSentences(sentences, paragraphs));
  return sentences.flatMap((sentence) => {
    const matched = exhortationIn(sentence, words.closing) ?? (last.has(sentence) ? lastIn(sentence, words) : undefined);
    return matched === undefined ? [] : [{ sentence, matched }];
  });
};

export const closingClicheWords = (lexicon: readonly LexiconEntry[]): Words => ({
  closing: exhortationWords(lexicon),
  last: lexicon.filter((entry) => entry.group === LAST),
  signoff: lexicon.filter((entry) => entry.group === SIGNOFF),
});

/** 結び（最後の節の終わりの段落）の定型の言い回し。limit は指摘に要る文の数。 */
export const closingCliche: Detector = (doc, options): Finding[] => {
  const hits = closingClicheHits(closingSentences(doc.sections, doc.paragraphs), doc.paragraphs, closingClicheWords(options.lexicon ?? []));
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
