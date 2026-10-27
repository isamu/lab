import { pairMinority, type PairUses } from "./contraction-minority.ts";
import { blankRanges, isTermList, withoutMentions } from "./contraction-mention.ts";
import { stressedWords } from "./contraction-emphasis.ts";
import { escapeRegExp, straightApostrophes } from "../orthography.ts";
import type { Detector, Finding, ProseDocument, Sentence, Span } from "../plugin.ts";

/**
 * 同じことを言う 2 つの書きかたが、1 つの文書で混ざっているか。
 *
 * **どちらが正しいかは決めない。** 短縮形を使うかどうかは文体の選択で、
 * 立場を取ると方針の違う書き手に rule ごと無視される。spec §12.3。
 *
 * 語彙表は対を持つ（`pattern` と `instead_of`）。比べるのは対の中だけで、別の語どうしは比べない。
 * GOV.UK の文体は「you're」を使い否定は「do not」と書く。語ごとに決めた書きかたで、混在ではない。
 * 否定と代名詞＋動詞の族にもまとめない。「don't」と「does not」を書き分ける文書もある。
 */

type Pair = { readonly short: string; readonly long: string };
type MixedPair = { readonly pair: Pair; readonly side: keyof PairUses; readonly minority: string; readonly majority: string; readonly count: number };

/**
 * 語の境界で照合する。部分一致だと「it isn't」が「it is」を含んでしまい、
 * 短縮形を使っている文が「使っていない」側に数えられる。
 */
const wordUses = (text: string, word: string): number => [...text.matchAll(new RegExp(`\\b${escapeRegExp(word)}\\b`, "gu"))].length;

/**
 * 書き手が選んだ形として数える文の字。引用で挙げた語句と語の一覧の中の形は、書き手の文体を語らないので空ける。
 * アポストロフィの形（don’t と don't）は短縮形かどうかを変えない。折り返した行も、空白 1 つと同じに読む。
 */
const comparableText = (text: string): string => {
  const counted = withoutMentions(straightApostrophes(text));
  return isTermList(counted) ? "" : counted.replace(/\s+/gu, " ").toLowerCase();
};

/**
 * 指してよい字。一語だけ強調した形（does **not**）は強勢のために選んだ形なので指さない。
 * 書き手がその形を書いたことには変わりないので、どちらが多いかを数えるときは数える。
 */
const pointableText = (sentence: Sentence, stressed: readonly Span[]): string => comparableText(blankRanges(sentence.text, sentence.span.start, stressed));

/** 語のすぐ後ろが句読点か文の終わり。名前として挙げた語（"Use cannot, instead of can't."）はそう並ぶ。 */
const bareUses = (text: string, word: string): number => [...text.matchAll(new RegExp(`\\b${escapeRegExp(word)}\\b(?=\\s*(?:\\p{P}|$))`, "gu"))].length;

/**
 * 1 文の中の、対の 2 つの形の数。両方の形をそれぞれ単独で挙げた文（"Use cannot, instead of can't."）は語を比べていて、
 * どちらも使っていない。両方を文の中で使う文（"It is important -- it's the most important"）はそのまま数える。
 */
const usesIn = (text: string, pair: Pair): PairUses => {
  const named = bareUses(text, pair.short) > 0 && bareUses(text, pair.long) > 0;
  return named ? { short: 0, long: 0 } : { short: wordUses(text, pair.short), long: wordUses(text, pair.long) };
};

const mixedPair = (texts: readonly string[], pair: Pair): MixedPair | undefined => {
  const uses = texts.reduce<PairUses>(
    (sum, text) => {
      const here = usesIn(text, pair);
      return { short: sum.short + here.short, long: sum.long + here.long };
    },
    { short: 0, long: 0 },
  );
  const side = pairMinority(uses);
  if (side === undefined) return undefined;
  return side === "short"
    ? { pair, side, minority: pair.short, majority: pair.long, count: uses.short }
    : { pair, side, minority: pair.long, majority: pair.short, count: uses.long };
};

const usesMinority = (text: string, mixed: MixedPair): boolean => usesIn(text, mixed.pair)[mixed.side] > 0;

const emphasisOf = (doc: ProseDocument): readonly Span[] => (doc.prose === undefined ? [] : stressedWords(doc.source, doc.prose));

export const contractionMix: Detector = (doc, options): Finding[] => {
  const stressed = emphasisOf(doc);
  // 文ごとに数える。文をつないで数えると、箇条書きの「What we do」と次の項目「not every…」が「do not」と数えられる。
  const texts = doc.sentences.map((sentence) => comparableText(sentence.text));
  const mixed = (options.lexicon ?? []).flatMap((entry) => {
    const pair = entry.instead_of === undefined ? undefined : mixedPair(texts, { short: entry.pattern.toLowerCase(), long: entry.instead_of.toLowerCase() });
    return pair === undefined || pair.count > options.limit ? [] : [pair];
  });
  const hits = doc.sentences.flatMap((sentence) => {
    const pointable = pointableText(sentence, stressed);
    const pair = mixed.find((candidate) => usesMinority(pointable, candidate));
    return pair === undefined ? [] : [{ sentence, pair }];
  });
  return hits.map(({ sentence, pair }) => ({
    rule: "contraction-consistency",
    severity: "info",
    line: 0,
    column: 0,
    quote: sentence.text.trim(),
    values: { matched: pair.minority, majority: pair.majority, count: pair.count, limit: options.limit, offset: sentence.span.start },
  }));
};
