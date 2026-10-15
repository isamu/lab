import { escapeRegExp } from "../orthography.ts";

/**
 * 大文字で書いた名前の部品と決まり文句で、展開を待つ略語ではないもの（JVLS, LLC、TRATON SE、AU$10、45 CFR §164、
 * Federal Express, UPS, DHL、HM Revenue & Customs、512 Bayshore DR、NOW, THEREFORE、AND/OR）。どれも語彙表の語が決まった形の中に
 * あるときだけ認める。語は言語パッケージの語彙表から読み、ここには形の組み立てだけを置く。
 */

type Span = { readonly start: number; readonly end: number };

/** 言語パッケージの語彙表から読む、名前の部品の語と決まり文句。字面どおりに照らす。 */
export type NameWords = {
  /** 会社名の後ろに大文字で書く法人の形（LLC、INC、SE、PTE、PTY）。 */
  readonly legalForms: readonly string[];
  /** 日本の会社の形（株式会社、㈱。語彙表 company-form）。すぐ隣の英字の語は会社の名前（㈱ADEKA、DOWAホールディングス㈱）。 */
  readonly companyForms: readonly string[];
  /** 名詞の前に置く限定の語（the、this、each）。文の頭で大文字になっても（The SE team）名前の語ではない。大小を問わずに照らす。 */
  readonly determiners: readonly string[];
  /** 法令・官報の引用の大文字の部分（45 CFR §164、21 USC §301、94/820/EC）。 */
  readonly citationSeries: readonly string[];
  /** 運送会社の名前（UPS、DHL、Federal Express）。2 社以上を並べたときだけ名前と読む。 */
  readonly carriers: readonly string[];
  /** 大文字で始まる語の前に置いて名前を作る語（HM Revenue & Customs、HMS Victory）。 */
  readonly namePrefixes: readonly string[];
  /** 番地と通りの名前の後ろに書く、通りの種類の略し（512 Bayshore DR）。 */
  readonly streetSuffixes: readonly string[];
  /** 大文字で書く決まり文句（NOW, THEREFORE、AND/OR）。句のままでだけ外す。OR だけなら Oregon でもある。 */
  readonly capitalPhrases: readonly string[];
};

const EDGE_BEFORE = String.raw`(?<![\p{L}\p{N}_&])`;
const EDGE_AFTER = String.raw`(?![\p{L}\p{N}_&])`;

/**
 * 語彙表の語のどれか。空の語彙表は「その書き方が無い」。空の選択肢 (?:) は至る所で空文字に当たるので、何にも当たらない形にする。
 * 長い語から試す。短い語が先だと、それを頭に持つ長い語（PTE と PTE. のような書き分け）が丸ごと当たらない。
 */
export const oneOf = (words: readonly string[]): string =>
  words.length === 0
    ? "(?!)"
    : `(?:${words
        .toSorted((left, right) => right.length - left.length)
        .map(escapeRegExp)
        .join("|")})`;

const spansOf = (text: string, pattern: RegExp): Span[] =>
  [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

/** 名前の語。大文字で始まり、点・& ・アポストロフィ・ハイフンを含んでよい（BorrowMoney.com、PTE.、O'Neil）。 */
const NAME_WORD = String.raw`\p{Lu}[\p{L}\p{N}&.'’-]*`;
/** 法人の形の前に並ぶ名前の語の数の上限（CNH INDUSTRIAL SOUTH DAKOTA, INC.）。文の頭まで遡って別の語を名前に入れないため。 */
const NAME_WORDS_MAX = 5;

/**
 * 名前の語のすぐ後ろ（読点を挟んでもよい）の法人の形と、その前の名前（JVLS, LLC、CPM Medical Consultants LLC、TRATON SE、
 * GitLab Singapore PTE. LTD.）。名前の語は空白だけで続くものを数え、読点で切れた先（CENTENE CORPORATION, MAYFLOWER …）は入れない。
 * 名前に続けて書いた括弧のすぐ後ろの形（SUNCALL（Guangzhou）CO.,LTD.、SUNCALL CO.,（H.K.）LTD.）も名前の終わり。日本語の文の中の「，」も区切り（JCI(THAILAND)CO.，LTD.）。空白を挟んだ括弧（Section (A) LLC）は名前の一部ではない。形のすぐ前が限定の語なら名前ではない（The SE team）。
 */
export const companyNameSpans = (text: string, forms: readonly string[], determiners: readonly string[]): Span[] => {
  if (forms.length === 0) return [];
  const single = `${oneOf(forms)}${EDGE_AFTER}`;
  // 形を重ねて書く（PTE. LTD.、CO.,LTD.）。
  const form = String.raw`${single}(?:\.?[,，]?[ \t]*${single})*`;
  const named = new RegExp(String.raw`${EDGE_BEFORE}(?:${NAME_WORD}[ \t]+){0,${NAME_WORDS_MAX - 1}}(?<last>${NAME_WORD})(?:[,，][ \t]*|[ \t]+)${form}`, "gu");
  const bracketed = new RegExp(String.raw`(?<=${NAME_WORD}[,，]?[(（][\p{L}. ]+[)）][ \t]*)${form}`, "gu");
  const determiner = new Set(determiners.map((word) => word.toLowerCase()));
  const names = [...text.matchAll(named)].filter((match) => !determiner.has((match.groups?.["last"] ?? "").toLowerCase()));
  return [...names.map((match) => ({ start: match.index, end: match.index + match[0].length })), ...spansOf(text, bracketed)];
};

/** 日本の会社の名前の英字の語（ADEKA、DOWA）。英字の語と形のあいだに書く名前の続きの片仮名（DOWAホールディングス㈱ の ホールディングス）。 */
const LATIN_NAME = "[A-Za-zＡ-Ｚａ-ｚ][A-Za-zＡ-Ｚａ-ｚ0-9０-９&＆]*";
const KATAKANA_TAIL = "[ァ-ヺー・]*";

/** 英字だけの形（英語の Ltd）は英字の語に続けて書かれず、続いて見えれば語の一部。漢字か片仮名を含む形だけを読む。 */
const NOT_LATIN = /[^\p{Script=Latin}\p{P}\s]/u;

/**
 * 日本の会社の形のすぐ後ろの英字の語（㈱ADEKA、株式会社ADEKA）と、片仮名を挟んですぐ前の英字の語（ADEKA株式会社、
 * DOWAホールディングス㈱）。名前の英字で、説明を待つ略語ではない。範囲は英字の語だけ。
 */
export const japaneseCompanyNameSpans = (text: string, forms: readonly string[]): Span[] => {
  const japanese = forms.filter((form) => NOT_LATIN.test(form));
  if (japanese.length === 0) return [];
  const form = oneOf(japanese);
  const after = new RegExp(`(?<=${form})${LATIN_NAME}`, "gu");
  const before = new RegExp(`(?<![A-Za-zＡ-Ｚａ-ｚ])${LATIN_NAME}(?=${KATAKANA_TAIL}${form})`, "gu");
  return [...spansOf(text, after), ...spansOf(text, before)];
};

/** 通貨の記号に付けた大文字（USD$、AU$10、US$ 5）。国や通貨の印で、略語ではない。 */
const CURRENCY_PREFIX = new RegExp(String.raw`${EDGE_BEFORE}\p{Lu}{1,3}(?=[$€£¥])`, "gu");

export const currencySymbolSpans = (text: string): Span[] => spansOf(text, CURRENCY_PREFIX);

/**
 * 引用の形の中の、法令の名前（45 CFR Parts 160、CFR §164.524、21 USC §301、22 CCR §§ 12701、94/820/EC）。後ろに条（§、Part、
 * 番号）があるか、/ で繋いだ番号の後ろのときだけ。法令集そのものを言う所（the CFR title、the 2 CFR export）は略語のまま数える。
 */
export const citationSpans = (text: string, series: readonly string[]): Span[] => {
  if (series.length === 0) return [];
  const name = oneOf(series);
  return spansOf(text, new RegExp(String.raw`(?<=\d/)${name}${EDGE_AFTER}|${EDGE_BEFORE}${name}(?=[ \t]*(?:§|[Pp]arts?[ \t]+\d|\d))`, "gu"));
};

/** 運送会社の名前。同じ文に 2 社以上を並べた所（Federal Express, UPS, DHL）だけ、どれも名前と読む。1 社だけの UPS は電源装置でもある。 */
export const carrierListSpans = (text: string, carriers: readonly string[]): Span[] => {
  if (carriers.length === 0) return [];
  const pattern = new RegExp(`${EDGE_BEFORE}${oneOf(carriers)}${EDGE_AFTER}`, "gu");
  const spans = spansOf(text, pattern);
  return new Set(spans.map((span) => text.slice(span.start, span.end))).size < 2 ? [] : spans;
};

/** 大文字で始まる語の前に置いた、名前を作る語（HM Revenue & Customs、HM Treasury）。 */
export const namePrefixSpans = (text: string, prefixes: readonly string[]): Span[] =>
  prefixes.length === 0 ? [] : spansOf(text, new RegExp(String.raw`${EDGE_BEFORE}${oneOf(prefixes)}(?=[ \t]+\p{Lu}\p{Ll})`, "gu"));

/** 番地と、大文字で始まり小文字が続く通りの名前の後ろの、通りの種類（512 Bayshore DR、4060 Johns Creek PKWY）。3 AI CT は住所ではない。 */
export const streetSuffixSpans = (text: string, suffixes: readonly string[]): Span[] =>
  suffixes.length === 0
    ? []
    : spansOf(text, new RegExp(String.raw`(?<=${EDGE_BEFORE}\d+[A-Z]?[ \t]+(?:\p{Lu}\p{Ll}[\p{L}'’.-]*[ \t]+){1,3})${oneOf(suffixes)}${EDGE_AFTER}`, "gu"));

/** 大文字で書く決まり文句（NOW, THEREFORE、AND/OR）。 */
export const capitalPhraseSpans = (text: string, phrases: readonly string[]): Span[] =>
  phrases.length === 0 ? [] : spansOf(text, new RegExp(`${EDGE_BEFORE}${oneOf(phrases)}${EDGE_AFTER}`, "gu"));

/** 文の中で、名前の部品と決まり文句として略語から外す大文字を含む範囲。語彙表から一度だけ組み立てて、文ごとに呼ぶ。 */
export const nameSpansOf =
  (words: NameWords) =>
  (text: string): Span[] => [
    ...companyNameSpans(text, words.legalForms, words.determiners),
    ...japaneseCompanyNameSpans(text, words.companyForms),
    ...currencySymbolSpans(text),
    ...citationSpans(text, words.citationSeries),
    ...carrierListSpans(text, words.carriers),
    ...namePrefixSpans(text, words.namePrefixes),
    ...streetSuffixSpans(text, words.streetSuffixes),
    ...capitalPhraseSpans(text, words.capitalPhrases),
  ];
