import type { Span } from "./plugin.ts";

/** かなと、読みの中に書く長音・中黒・空白だけの括弧書き。 */
const KANA_ASIDE = /[（(][\p{Script=Hiragana}\p{Script=Katakana}ー・ 　]+[）)]/gu;

const HIRAGANA = /\p{Script=Hiragana}/u;
const KATAKANA = /\p{Script=Katakana}/u;
/** 読みを付ける語の終わりの字。ひらがなの後ろの括弧書きは読みではなく挟んだ言葉（「これは（たぶん）」）。 */
const WORD_END = /[\p{L}\p{N}]/u;
/** 番号の読み（＃8891（はやくワンストップ））は語呂合わせで、片仮名が交じる。語の後ろの片仮名の括弧は言い換え（電話（スマホ））。 */
const NUMBER_END = /\p{N}/u;

/**
 * text の中の、語の直後のふりがなの括弧（「HTTP（えいちてぃーてぃーぴー）」「脆弱性（ぜいじゃくせい）」）と、番号の直後の読みの括弧
 * （「＃8891（はやくワンストップ）」）の範囲。括弧を含む。語の読みであって、語の書き方ではない。位置は text の先頭を 0 とする。
 */
export const furiganaSpans = (text: string): Span[] =>
  [...text.matchAll(KANA_ASIDE)]
    .filter((match) => {
      const before = text.charAt(match.index - 1);
      const reads = HIRAGANA.test(match[0]) && WORD_END.test(before) && !HIRAGANA.test(before);
      return reads && (!KATAKANA.test(match[0]) || NUMBER_END.test(before));
    })
    .map((match) => ({ start: match.index, end: match.index + match[0].length }));
