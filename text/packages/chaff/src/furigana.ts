import type { Span } from "./plugin.ts";

/** ひらがなと、読みの中に書く長音・中黒・空白だけの括弧書き。 */
const KANA_ASIDE = /[（(][\p{Script=Hiragana}ー・ \u3000]+[）)]/gu;

const HIRAGANA = /\p{Script=Hiragana}/u;
/** 読みを付ける語の終わりの字。ひらがなの後ろの括弧書きは読みではなく挟んだ言葉（「これは（たぶん）」）。 */
const WORD_END = /[\p{L}\p{N}]/u;

/**
 * text の中の、語の直後のふりがなの括弧（「HTTP（えいちてぃーてぃーぴー）」「脆弱性（ぜいじゃくせい）」）の範囲。括弧を含む。
 * 語の読みであって、語の書き方ではない。位置は text の先頭を 0 とする。
 */
export const furiganaSpans = (text: string): Span[] =>
  [...text.matchAll(KANA_ASIDE)]
    .filter((match) => {
      const before = text.charAt(match.index - 1);
      return HIRAGANA.test(match[0]) && WORD_END.test(before) && !HIRAGANA.test(before);
    })
    .map((match) => ({ start: match.index, end: match.index + match[0].length }));
