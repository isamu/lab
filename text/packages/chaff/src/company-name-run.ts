import { escapeRegExp } from "./orthography.ts";
import type { Span } from "./plugin.ts";

/** 会社の名前に使う字（漢字・片仮名・英数字）。かなや句読点で名前は切れる。 */
const NAME_CHAR = "[\\p{Script=Han}々〆ヶァ-ヺーA-Za-zＡ-Ｚａ-ｚ0-9０-９&＆・]";

/** 漢字か片仮名を含む形（株式会社、㈱、(株)）。英字だけの形は日本語の名前の目印にならない。 */
const NOT_LATIN = /[^\p{Script=Latin}\p{P}\s]/u;

/**
 * text の中の、日本の会社の形（語彙表 company-form）とその隣の名前の範囲（関東珪曹硝子㈱、株式会社ADEKA）。
 * 名前は書き手が選べない字で書かれるので、表記のゆれを数える語に入れない。形の前は名前の字が続くかぎり、形の後ろも同じ。
 */
export const japaneseCompanyNameSpans = (text: string, forms: readonly string[]): Span[] => {
  const japanese = forms.filter((form) => NOT_LATIN.test(form));
  if (japanese.length === 0) return [];
  const form = `(?:${[...japanese]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|")})`;
  const named = new RegExp(`${NAME_CHAR}*${form}${NAME_CHAR}*`, "gu");
  return [...text.matchAll(named)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
};
