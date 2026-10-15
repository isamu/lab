import { escapeRegExp } from "../orthography.ts";
import { latinCompanyFormSpans } from "../latin-company-form.ts";
import type { Span } from "../plugin.ts";

/**
 * 会社の名前を読むための語。forms は日本の会社の形（株式会社、㈱。語彙表 company-form）、latinForms は英字の会社の形
 * （CO.,LTD.、INC.。語彙表 company-form-latin から作った正規表現）。
 */
export type CompanyNameWords = { readonly forms: readonly string[]; readonly latinForms: RegExp | undefined };

/** 名前の英字の語（ADEKA、DOWA、NTT）。 */
const LATIN_WORD = "[A-Za-zＡ-Ｚａ-ｚ][A-Za-zＡ-Ｚａ-ｚ0-9０-９&＆]*";
/** 英字の語と形のあいだに書く、名前の続きの片仮名（DOWAホールディングス㈱ の ホールディングス）。 */
const KATAKANA_TAIL = "[ァ-ヺー・]*";

const groupSpan = (match: RegExpMatchArray, group: string): Span[] => {
  const word = match.groups?.[group];
  if (word === undefined || match.index === undefined) return [];
  const start = match.index + match[0].indexOf(word);
  return [{ start, end: start + word.length }];
};

/** 英字だけの形（英語の Ltd、PLC）は英字の語に続けて書かれず、続いて見えれば語の一部（SPLC）。漢字を含む形だけを読む。 */
const NOT_LATIN = /[^\p{Script=Latin}\p{P}\s]/u;

/** 日本の会社の形のすぐ後ろの英字の語（㈱ADEKA、株式会社ADEKA）と、片仮名を挟んですぐ前の英字の語（ADEKA株式会社、DOWAホールディングス㈱）。 */
const namesBesideForms = (text: string, forms: readonly string[]): Span[] => {
  const japanese = forms.filter((form) => NOT_LATIN.test(form));
  if (japanese.length === 0) return [];
  const form = `(?:${[...japanese]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|")})`;
  const after = new RegExp(`${form}(?<name>${LATIN_WORD})`, "gu");
  const before = new RegExp(`(?<![A-Za-zＡ-Ｚａ-ｚ])(?<name>${LATIN_WORD})${KATAKANA_TAIL}${form}`, "gu");
  return [...text.matchAll(after), ...text.matchAll(before)].flatMap((match) => groupSpan(match, "name"));
};

/**
 * text の中の、会社の名前の一部と読める英字の範囲。英字の会社の形そのもの（CO.,LTD. の CO と LTD）と、日本の会社の形の隣の
 * 英字の語（㈱ADEKA）。どちらも名前で、説明を待つ略語ではない。
 */
export const companyNameSpans = (text: string, words: CompanyNameWords): Span[] => [
  ...latinCompanyFormSpans(text, words.latinForms),
  ...namesBesideForms(text, words.forms),
];
