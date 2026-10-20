import { furiganaSpans } from "./furigana.ts";
import { escapeRegExp } from "./orthography.ts";
import type { Span } from "./plugin.ts";

const HIRAGANA = /\p{Script=Hiragana}/u;
const WORD_END = /[\p{L}\p{N}]/u;

/** 語の中に書いた読み（拓（ひら）く）。読みの括弧の後ろに送り仮名や助詞が続く、語の一部としての括弧だけ。 */
const readingSpans = (text: string): Span[] => furiganaSpans(text).filter((span) => HIRAGANA.test(text.charAt(span.end)));

/** 名前のすぐ後ろに付けた添え書き（栄養教諭（仮称）、計画（案））。words は語彙表 bracket-annotation の語。 */
const annotationSpans = (text: string, words: readonly string[]): Span[] => {
  if (words.length === 0) return [];
  const pattern = new RegExp(`[（(](?:${words.map(escapeRegExp).join("|")})[）)]`, "gu");
  return [...text.matchAll(pattern)]
    .filter((match) => WORD_END.test(text.charAt(match.index - 1)))
    .map((match) => ({ start: match.index, end: match.index + match[0].length }));
};

/**
 * 語の一部として書いた括弧（読みの 拓（ひら）く、添え書きの 栄養教諭（仮称））を除いた text。読み手はこれを語として読み、
 * 開いた括弧として覚えておく必要が無いので、括弧の重なりに数えない。挟んだ言葉（本文（氏名（ふりがな））の「ふりがな」）は残す。
 */
export const withoutWordBrackets = (text: string, annotations: readonly string[]): string =>
  [...readingSpans(text), ...annotationSpans(text, annotations)]
    .toSorted((left, right) => right.start - left.start)
    .reduce((rest, span) => `${rest.slice(0, span.start)}${rest.slice(span.end)}`, text);
