import { ROMAN_NUMERAL, romanRangeOf } from "./roman-numeral.ts";
import { citationKeySpans } from "./citation-key.ts";
import { dottedNameSpans } from "./dotted-name.ts";
import { capitalJoinedNameSpans, letterJoinedNameSpans } from "./letter-joined-name.ts";
import { loneNumeralSpans, nameNumeralSpans } from "./name-numeral.ts";
import { placeholderSpans } from "./placeholder.ts";
import { numeralWordSpans } from "./numeral-word.ts";
import { seriesLabelSpans } from "./series-label.ts";
import { nameSpansOf, oneOf, postalAddressSpans } from "./acronym-name.ts";
import { grammarSpans } from "./abnf-grammar.ts";
import { outlineLabelSpans } from "./outline-label.ts";
import { referenceListSpans } from "../reference-lists.ts";
import { linkTitleSpans } from "./acronym-link.ts";
import { citationNoteSpans } from "./citation-note.ts";
import { documentCitationSpans } from "./case-citation.ts";
import { referenceEntrySpans } from "./reference-entry.ts";
import { chatLogSpans } from "./chat-log-line.ts";

/**
 * 大文字の語が略語ではなく、決まった書き方の一部として読める所（3:30 PM、1pm ET、USD 1,000、Kansas City, MO 64108、Fort Lauderdale FL 33304）。
 * どれも閉じた集合で、しかも隣の数字（州は地名でもよい）があるときだけ認める。PM（project manager）、CT、CA（certificate authority）は
 * その隣でなければ略語のまま数える。語は言語パッケージの語彙表から読み、書き方の組み立てだけをここに置く。
 */

type Span = { readonly start: number; readonly end: number };

/** 言語パッケージの語彙表から読む、数字の隣でだけ略語から外す語と、単独で強調として書かれる語。字面どおりに照らす。 */
export type NotationWords = {
  readonly meridiem: readonly string[];
  readonly timeZones: readonly string[];
  readonly currencies: readonly string[];
  readonly usStates: readonly string[];
  readonly emphasis: readonly string[];
  /** 番号を後ろに書く、文書の区切りの名前（Part、Section、Title）。 */
  readonly divisions: readonly string[];
  /** 番号を後ろに書く、点の付いた略した名前（Vol.、No.、FIG.）。 */
  readonly abbreviatedLabels: readonly string[];
  /** 速記録が大文字で書く発言者の姓の前に置く敬称（Mr.、Mrs.、Madam）。 */
  readonly honorifics: readonly string[];
  /** 大文字で書く姓の前に置く肩書き（Prime Minister、Governor）。後ろに略語も来る（the President NASA memo）ので、名前の形を求める。 */
  readonly titles: readonly string[];
  /** 日付・時刻の数字の後ろに書く単位（年、月、日、時、分）。その前の同じ大文字の繰り返し（YY年）は書式の置き場所。 */
  readonly dateTimeUnits: readonly string[];
  /** ショートメッセージでキーワードを送る動詞（text GNPCGS to 333111 の text）。 */
  readonly textMessageVerbs?: readonly string[];
  /** 行の頭に大文字で書く接続詞（OR, Skip to …）。略語でもある語（OR は Oregon）なので、行の頭で読点と名前の形か行の終わりが続くときだけ。 */
  readonly openingConjunctions?: readonly string[];
};

const MINUTES = String.raw`:[0-5]\d`;
const CLOCK_12 = String.raw`(?<![\d:.])(?:1[0-2]|0?[1-9])(?:${MINUTES})?`;
const CLOCK_24 = String.raw`(?<![\d:.])(?:[01]?\d|2[0-3])${MINUTES}`;
/** 時間帯の前の午前・午後は書き方を問わない（pm、p.m.、P.M.、PM）。 */
const ANY_MERIDIEM = String.raw`[AaPp]\.?[Mm]\.?`;
/** 桁区切りは 3 桁ずつ揃っているときだけ金額と読む。「item 1, USD」の 1, は金額ではない。 */
const AMOUNT = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;

/**
 * 区切りの名前や略した名前のすぐ後ろの番号（Part II、Section VIII、TITLE IV、Vol. XLIII、FIG. 3、FIGS. 1A-1C）。名前は語彙表の
 * 書き方か、全部大文字。ローマ数字は範囲（Part II-IV）も番号。CD や CI のようにローマ数字としても読める略語は、この位置で
 * なければ略語のまま数える。
 */
const divisionOf = (words: readonly string[]): string => oneOf(words.flatMap((word) => [word, word.toUpperCase()]));

/** 図や表の番号は短い（FIG. 3、TABLE 12、FIG. 1A）。長い数（FIG. 12345）の前の大文字は略語のまま数える。 */
const SHORT_NUMBER = String.raw`\d{1,3}[A-Za-z]?`;
const NUMBER_END = String.raw`(?![\p{L}\p{N}_&])`;

const numberedPatterns = (words: NotationWords): readonly RegExp[] => {
  const label = String.raw`(?<![\p{L}\p{N}_])${divisionOf([...words.divisions, ...words.abbreviatedLabels])}\s+`;
  return [new RegExp(`${label}${romanRangeOf(ROMAN_NUMERAL)}${NUMBER_END}`, "gu"), new RegExp(`${label}${SHORT_NUMBER}${NUMBER_END}`, "gu")];
};

/** 敬称のすぐ後ろの大文字の姓（Mr. HAWLEY、Dr. O'NEIL）。速記録は発言者をこう書き、略語ではない。 */
const SURNAME_IN_CAPITALS = String.raw`[A-Z]+(?:['’-][A-Z]+)*(?![\p{L}\p{N}_])`;

/**
 * 文頭か行頭の、点で終わる敬称の大文字の書き方と大文字の名前（判決の MR. JUSTICE REHNQUIST took no part …、MR. CHIEF JUSTICE BURGER）。文の途中の MR.（the MR.
 * HAWLEY file）と点の無い DR（disaster recovery）は略語でもあるので、頭に立つ点の付いた形だけ。
 */
const capitalHonorific = (words: readonly string[]): RegExp =>
  new RegExp(
    String.raw`(?<=(?:^|\n)[ \t]*)${oneOf(words.filter((word) => word.endsWith(".")).map((word) => word.toUpperCase()))}(?:\s+${SURNAME_IN_CAPITALS}){1,3}`,
    "gu",
  );

/**
 * 肩書きの後ろの大文字の語が姓と読めるのは、名前の形のときだけ。行頭の発言者の印（Senator HAWLEY.、Chairman JORDAN:）か、
 * 日本政府の英文が「姓 名」の順に書くローマ字の名前（Prime Minister ABE Shinzo）。the President NASA memo と
 * The Secretary GDPR: Article 5 の略語は数える。
 */
const GIVEN_NAME_AFTER = String.raw`(?=\s+\p{Lu}\p{Ll}+(?![\p{L}\p{N}_]))`;
const titledName = (titles: string): readonly RegExp[] => [
  new RegExp(String.raw`(?<=(?:^|\n)[ \t]*)${titles}\s+${SURNAME_IN_CAPITALS}(?=[.:])`, "gu"),
  new RegExp(String.raw`(?<![\p{L}\p{N}_])${titles}\s+${SURNAME_IN_CAPITALS}${GIVEN_NAME_AFTER}`, "gu"),
];

/**
 * 郵便番号の無い所在地（Chicago, IL、Charleston, SC and…、Washington, DC: Association…）。頭が大文字の地名と読点の後ろで、
 * 文や行の終わり・区切り・小文字の語が続くときだけ州と読む。数字や大文字の語が続くもの（Berkeley, CA 947、Sales, PA Team）は外さない。
 */
const placeAndState = (states: string): RegExp =>
  new RegExp(String.raw`(?<=\p{Lu}\p{Ll}[\p{L}'’.-]*,\s+)${states}(?=[ \t]*(?:\r?\n|$)|[,.;:)\]!?]|\s+\p{Ll})`, "gu");

/**
 * ショートメッセージで送るキーワード（texting GNPCGS to 333111）。動詞と短い番号の間の大文字は、そのまま打ち込む文字列。
 * 番号は短縮番号の桁（4 から 6 桁）で、動詞の無い「GDP to 3000」は略語のまま数える。
 */
const textMessageKeyword = (verbs: readonly string[]): RegExp =>
  new RegExp(String.raw`(?<![\p{L}\p{N}_])${oneOf(verbs)}\s+["“']?[A-Z][A-Z0-9]+["”']?\s+to\s+\d{4,6}(?!\d)`, "giu");

/**
 * 行の頭に大文字で書いた接続詞（OR, Skip to the topics …、選択肢の間に一行で置いた OR）。読点の後ろに頭だけ大文字の語が続くか、
 * その行がそこで終わるときだけ。州の並び（OR, WA and ID）や文の途中の OR（the OR staff）は略語のまま数える。
 */
const openingConjunction = (words: readonly string[]): RegExp =>
  new RegExp(String.raw`(?<=(?:^|\n)[ \t]*)${oneOf(words)}(?=,[ \t]+\p{Lu}\p{Ll}|[ \t]*(?:\r?\n|$))`, "gu");

/** メールアドレス（OASH-RFI@hhs.gov）。@ の前の大文字は宛先の名前で、略語ではない。 */
const EMAIL_ADDRESS = /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;

// 強調の記号は空白に置き換えてある（**3:30** PM）ので、部品の間の空白は数を問わない。
const patternsOf = (words: NotationWords): readonly RegExp[] => [
  new RegExp(String.raw`${CLOCK_12}\s*${oneOf(words.meridiem)}`, "gu"),
  new RegExp(String.raw`(?:${CLOCK_24}|${CLOCK_12}\s*${ANY_MERIDIEM})\s*${oneOf(words.timeZones)}`, "gu"),
  new RegExp(String.raw`${oneOf(words.currencies)}\s*[$€£¥]?${AMOUNT}`, "gu"),
  new RegExp(String.raw`(?<![\w.,])${AMOUNT}\s*${oneOf(words.currencies)}`, "gu"),
  new RegExp(String.raw`(?:,\s+|(?<=(?<!\p{L})\p{Lu}\p{Ll}+)\s+)${oneOf(words.usStates)}\s+\d{5}(?:-\d{4})?(?!\d)`, "gu"),
  placeAndState(oneOf(words.usStates)),
  new RegExp(oneOf(words.emphasis), "gu"),
  ...numberedPatterns(words),
  new RegExp(String.raw`(?<![\p{L}\p{N}_])${oneOf(words.honorifics)}\s+${SURNAME_IN_CAPITALS}`, "gu"),
  capitalHonorific(words.honorifics),
  ...titledName(oneOf(words.titles)),
  textMessageKeyword(words.textMessageVerbs ?? []),
  openingConjunction(words.openingConjunctions ?? []),
  EMAIL_ADDRESS,
];

export type NotAcronymSpans = (text: string) => Span[];

/**
 * 文の中で、略語として数えない大文字を含む範囲。語彙表から一度だけ組み立てて、文ごとに呼ぶ。
 * 略語は範囲にまるごと入るときだけ外れるので、語の境目は見なくてよい（NOTE の中の NOT）。
 */
export const notAcronymSpansOf = (words: NotationWords): NotAcronymSpans => {
  const patterns = patternsOf(words);
  return (text) => [
    ...patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }))),
    ...citationKeySpans(text),
    ...dottedNameSpans(text),
    ...letterJoinedNameSpans(text),
    ...capitalJoinedNameSpans(text),
    ...nameNumeralSpans(text),
    ...loneNumeralSpans(text),
    ...seriesLabelSpans(text),
    ...placeholderSpans(text, words.dateTimeUnits),
    ...numeralWordSpans(text),
  ];
};

/**
 * 略語として数えない範囲（書き方の範囲と、名前の中の範囲）を、言語パッケージの語彙表から組み立てる。wordsOf は語彙表の id から語を返す。
 */
export const lexiconNotationOf = (wordsOf: (id: string) => string[]): NotAcronymSpans => {
  const notation = notAcronymSpansOf({
    meridiem: wordsOf("meridiem"),
    timeZones: wordsOf("time-zone"),
    currencies: wordsOf("currency-code"),
    usStates: wordsOf("us-state-code"),
    emphasis: wordsOf("emphasis-word"),
    divisions: wordsOf("numbered-division"),
    abbreviatedLabels: wordsOf("abbreviated-label"),
    honorifics: wordsOf("honorific"),
    titles: wordsOf("name-title"),
    dateTimeUnits: wordsOf("date-time-unit"),
    textMessageVerbs: wordsOf("text-message-verb"),
    openingConjunctions: wordsOf("opening-conjunction"),
  });
  const names = nameSpansOf({
    legalForms: wordsOf("legal-form"),
    companyForms: wordsOf("company-form"),
    determiners: wordsOf("name-determiner"),
    citationSeries: wordsOf("citation-series"),
    carriers: wordsOf("carrier-name"),
    namePrefixes: wordsOf("name-prefix"),
    streetSuffixes: wordsOf("street-suffix"),
    capitalPhrases: wordsOf("capital-phrase"),
    productNames: wordsOf("product-name"),
  });
  return (text) => [...notation(text), ...names(text)];
};

/** 文書全体で読む、略語として数えない範囲。文献一覧の誌名や会議名、番号の付いた区切りの見出し、ABNF の文法、文に切れ目の入る所在地（Rd. NE）。 */
export const sourceNotAcronymSpans = (source: string, wordsOf: (id: string) => string[]): Span[] => [
  ...postalAddressSpans(source, wordsOf("street-suffix"), wordsOf("us-state-code")),
  ...referenceListSpans(source, wordsOf("reference-list-heading")),
  ...outlineLabelSpans(source, wordsOf("numbered-division")),
  ...grammarSpans(source),
];

/**
 * 数には入れるが指さない略語の範囲。リンク先の題名、文献を引いて始まる注、判例の引用の当事者・裁判所・事件番号、
 * 角括弧の見出しで始まる文献の項目（[FETCH]    WHATWG, "Fetch"）、貼り付けたチャットの発言（<jinxer-wm> FIRING: …）は、書き手が直せない。
 */
export const unreportedAcronymSpans = (
  source: string,
  sentences: readonly { readonly text: string; readonly span: Span }[],
  links: readonly Span[],
  wordsOf: (id: string) => string[],
): Span[] => [
  ...linkTitleSpans(source, links),
  ...citationNoteSpans(source, sentences, wordsOf("citation-author-joiner")),
  ...documentCitationSpans(sentences, source, wordsOf("case-party-joiner")),
  ...referenceEntrySpans(source),
  ...chatLogSpans(source),
];
