import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { cuedNamesIn, mentionsIn, nameVariants, suffixedNamesIn, withKnownNeighbours, type NameMention, type VariantChars } from "../name-variants.ts";
import type { SpellingInput } from "../name-spelling-chars.ts";
import type { CharReadings } from "../name-char-reading.ts";
import { nameCueAt, type NameCues } from "../name-cue.ts";
import { quoteAt } from "./structure-tree.ts";
import { companyMentionsIn, companyVariants, type CompanyForm, type IsProper } from "../company-names.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { tableBodyCells } from "../facts/table-facts.ts";
import { cellNamesIn, cellNameVariants, proseNamesOf } from "../table-names.ts";
import { placeMentionsIn, placeVariants, type PlaceChars, type PlaceReader, type PlaceWord } from "../place-names.ts";
import { productMentionsIn, productVariants, type ProductForm } from "../product-names.ts";
import type { Span, TableCell, Token } from "../plugin.ts";
import { proseWithCells } from "../table-cells.ts";
import { modelCodeFindings } from "./name-variant-model-codes.ts";
import { labelledSpans, orderNamesOf, quotedSpans, stemOf, titleCaseSpans, wordOrderVariants, type OrderWord } from "../name-word-order.ts";

// 人の名前と読ませる敬称（様、さん）は語彙表 person-suffix、人を指す前置き（担当の）は person-lead、名前のすぐ後ろに来る語
// （です、まで）は name-particle、字体の違う同じ字（斎・斉・齋）は name-variant-char が組（group）ごとに言う。

const variantCharsOf = (doc: ProseDocument): VariantChars =>
  new Map((doc.lexicons["name-variant-char"] ?? []).flatMap((entry): [string, string][] => (entry.group === undefined ? [] : [[entry.pattern, entry.group]])));

/** 解析器が読めない名前の字（汰）の読みは、語彙表 name-char-reading が組（group）に言う。 */
const charReadingsOf = (doc: ProseDocument): CharReadings =>
  new Map((doc.lexicons["name-char-reading"] ?? []).flatMap((entry): [string, string][] => (entry.group === undefined ? [] : [[entry.pattern, entry.group]])));

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

/** 会社の形の語（株式会社、Inc）は語彙表 company-form が、同じ形の組（group）と名前のどちら側に立つか（position）とともに言う。 */
const companyFormsOf = (doc: ProseDocument): CompanyForm[] =>
  (doc.lexicons["company-form"] ?? []).map((entry) => ({ pattern: entry.pattern, group: entry.group ?? entry.pattern, position: entry.position }));

/** source の上の範囲に、品詞解析が固有名詞と読んだ語が掛かるか。 */
const properOf = (doc: ProseDocument): IsProper => {
  const spans = doc.sentences.flatMap((sentence) => (sentence.tokens ?? []).filter((token) => token.pos === "PROPN").map((token) => token.span));
  return (start, end) => spans.some((span) => span.start < end && start < span.end);
};

/** 場所の名前の終わりに立つ語（口、駅、Street、St.）は語彙表 place-word が、同じ語の別の書き方の組（group）とともに言う。 */
const placeWordsOf = (doc: ProseDocument): PlaceWord[] =>
  (doc.lexicons["place-word"] ?? []).map((entry) => ({ pattern: entry.pattern, group: entry.group ?? entry.pattern }));

/**
 * 場所の名前の字。方角や位置の字（東、上、新）は語彙表 place-direction、読みの同じ字（洲 と 州）は place-name-char と、字体の違う
 * 同じ字の name-variant-char が組（group）ごとに言う。
 */
const placeCharsOf = (doc: ProseDocument, chars: VariantChars): PlaceChars => ({
  directions: new Set(patternsOf(doc, "place-direction")),
  sameReading: new Map([
    ...chars,
    ...(doc.lexicons["place-name-char"] ?? []).flatMap((entry): [string, string][] => (entry.group === undefined ? [] : [[entry.pattern, entry.group]])),
  ]),
});

/** 名前の頭に立たない語の品詞（The、at、and）。 */
const FUNCTION_POS: ReadonlySet<string> = new Set(["DET", "ADP", "PRON", "CCONJ", "SCONJ", "AUX", "PART"]);

/** 表の本体の升。本文が表を覆わない文書（Markdown でない）には無い。 */
const cellsOf = (doc: ProseDocument): readonly TableCell[] => doc.tableCells?.() ?? tableBodyCells(proseAndTablesOf(doc));

/** 文の語と表の升の語を、文書の順に。 */
const tokensOf = (doc: ProseDocument): Token[] =>
  [...doc.sentences.flatMap((sentence) => sentence.tokens ?? []), ...cellsOf(doc).flatMap((cell) => cell.tokens ?? [])].toSorted(
    (left, right) => left.span.start - right.span.start,
  );

/** 場所の名前の語の数の上限。名前の読みを探す範囲。 */
const MAX_PLACE_TOKENS = 20;

/** 範囲をちょうど覆う語の読みをつないだもの。記号の語は読まない。覆えないか、読めない語があれば無い。 */
const readingIn = (tokens: readonly Token[], startAt: ReadonlyMap<number, number>, start: number, end: number): string | undefined => {
  const first = startAt.get(start);
  if (first === undefined) return undefined;
  const window = tokens.slice(first, first + MAX_PLACE_TOKENS);
  const covering = window.slice(0, window.findIndex((token) => token.span.end >= end) + 1);
  if (covering.at(-1)?.span.end !== end) return undefined;
  const readings = covering.filter((token) => token.pos !== "PUNCT").map((token) => token.reading);
  return readings.every((reading) => reading !== undefined && reading !== "") ? readings.join("") : undefined;
};

const placeReaderOf = (doc: ProseDocument): PlaceReader => {
  const tokens = tokensOf(doc);
  const startAt = new Map(tokens.map((token, index) => [token.span.start, index]));
  const functionStarts = new Set(tokens.filter((token) => FUNCTION_POS.has(token.pos)).map((token) => token.span.start));
  return {
    properWords: (start, end) => {
      const first = startAt.get(start);
      const window = first === undefined ? [] : tokens.slice(first, first + MAX_PLACE_TOKENS);
      return window.filter((token) => token.pos === "PROPN" && token.span.start < end).map((token) => token.span);
    },
    joiners: new Set(patternsOf(doc, "place-name-joiner")),
    isFunctionWord: (start) => functionStarts.has(start),
    readingOf: (start, end) => readingIn(tokens, startAt, start, end),
  };
};

type Reported = { readonly offset: number; readonly name: string; readonly usual: string; readonly kind: string };

const overlapsAny = (reported: readonly Reported[], offset: number, length: number): boolean =>
  reported.some((other) => other.offset < offset + length && offset < other.offset + other.name.length);

/** 会社の名前の頭のひらがなを切り分ける語は、語彙表 company-name-kana が組（particle、opener、end）ごとに言う。 */
const kanaStopsOf = (doc: ProseDocument): Parameters<typeof companyMentionsIn>[3] => {
  const entries = doc.lexicons["company-name-kana"] ?? [];
  const inGroup = (group: string): string[] => entries.filter((entry) => entry.group === group).map((entry) => entry.pattern);
  return { particles: inGroup("particle"), openers: inGroup("opener"), ends: inGroup("end") };
};

/** 会社の名前の書き分け。名前の見方がすでに指した所と重なるものは除く。 */
const companyFindings = (doc: ProseDocument, prose: string, reported: readonly Reported[]): Reported[] =>
  companyVariants(companyMentionsIn(prose, companyFormsOf(doc), properOf(doc), kanaStopsOf(doc)))
    .filter(({ mention }) => !overlapsAny(reported, mention.offset, mention.surface.length))
    .map(({ mention, usual, kind }) => ({ offset: mention.offset, name: mention.surface, usual, kind: kind === "spelling" ? kind : `company-${kind}` }));

/** 場所の名前の書き分け。表の本体の升の中の名前も読む（見出しの行は読まない）。人や会社の名前の見方がすでに指した所と重なるものは除く。 */
const placeFindings = (doc: ProseDocument, prose: string, reported: readonly Reported[], chars: VariantChars): Reported[] =>
  placeVariants(placeMentionsIn(proseWithCells(prose, cellsOf(doc)), placeWordsOf(doc), placeReaderOf(doc)), placeCharsOf(doc, chars))
    .filter(({ mention }) => !overlapsAny(reported, mention.offset, mention.surface.length))
    .map(({ mention, usual, kind }) => ({ offset: mention.offset, name: mention.surface, usual, kind }));

/** 製品の形の語（錠、カプセル、クリーム）は語彙表 product-form が、同じ形の別の書き方の組（group）とともに言う。 */
const productFormsOf = (doc: ProseDocument): ProductForm[] =>
  (doc.lexicons["product-form"] ?? []).map((entry) => ({ pattern: entry.pattern, group: entry.group ?? entry.pattern }));

/** 見出しの文字の範囲。本文（prose）は見出しを覆う。 */
const headingTextsOf = (doc: ProseDocument): (Span & { readonly text: string })[] =>
  (doc.markup?.headings ?? []).flatMap((heading) => {
    const start = doc.source.indexOf(heading.text, heading.start);
    return start < 0 || start + heading.text.length > heading.end ? [] : [{ start, end: start + heading.text.length, text: heading.text }];
  });

/** 製品の名前の書き損じ。題や見出し（ミナモール錠 添付文書）と表の本体の升の中の名前も読む。ほかの見方がすでに指した所と重なるものは除く。 */
const productFindings = (doc: ProseDocument, prose: string, reported: readonly Reported[]): Reported[] =>
  productVariants(productMentionsIn(proseWithCells(prose, [...cellsOf(doc), ...headingTextsOf(doc)]), productFormsOf(doc)))
    .filter(({ mention }) => !overlapsAny(reported, mention.offset, mention.surface.length))
    .map(({ mention, usual, kind }) => ({ offset: mention.offset, name: mention.surface, usual, kind }));

/** 名前の中で比べる語の品詞。助詞や冠詞（の、of）は語の順に数えない。 */
const CONTENT_POS: ReadonlySet<string> = new Set(["NOUN", "PROPN", "ADJ", "NUM", "VERB"]);

/** 欄の後ろの名前を切る所: 内容語でも名前の中の小さな語（of）でもない語の頭。 */
const orderStopsOf = (doc: ProseDocument): number[] => {
  const joiners = new Set(patternsOf(doc, "name-title-joiner"));
  return tokensOf(doc)
    .filter((token) => !CONTENT_POS.has(token.pos) && !joiners.has(token.surface.toLowerCase()))
    .map((token) => token.span.start);
};

const sentenceStartsOf = (doc: ProseDocument): ReadonlySet<number> => new Set(doc.sentences.flatMap((sentence) => sentence.tokens?.[0]?.span.start ?? []));

const orderWordsOf = (doc: ProseDocument): OrderWord[] => {
  const suffixes = patternsOf(doc, "name-stem-suffix");
  return tokensOf(doc)
    .filter((token) => CONTENT_POS.has(token.pos))
    .map((token) => ({ start: token.span.start, end: token.span.end, key: stemOf(token.surface, suffixes) }));
};

/**
 * 語の順を入れ替えて書いた同じ名前（統計学基礎 と 基礎統計学）。名前と読める所は、括弧の中（name-quote）、大文字で始まる語の並び
 * （name-title-joiner を挟んでよい）、名前を書く欄の後ろ（name-label）。大文字の語の並びどうしは、片方が表の升まるごとに
 * 書いた名前のときだけ比べる。ほかの見方がすでに指した所と重なるものは除く。
 */
const orderFindings = (doc: ProseDocument, prose: string, reported: readonly Reported[]): Reported[] => {
  const starts = sentenceStartsOf(doc);
  const spans = [
    ...quotedSpans(prose, patternsOf(doc, "name-quote")),
    ...titleCaseSpans(prose, patternsOf(doc, "name-title-joiner"), (offset) => starts.has(offset)),
    ...labelledSpans(prose, patternsOf(doc, "name-label")),
  ];
  const cells = new Set(tableBodyCells(proseAndTablesOf(doc)).map((cell) => cell.text.trim()));
  return wordOrderVariants(orderNamesOf(doc.source, spans, orderWordsOf(doc), orderStopsOf(doc)), cells)
    .filter(({ name }) => !overlapsAny(reported, name.offset, name.surface.length))
    .map(({ name, usual }) => ({ offset: name.offset, name: name.surface, usual, kind: "order" }));
};

/** 人・製品・会社の名前の現れ。解析器が固有名詞と読む語、敬称の付く名前、前後の語で名前と読める漢字。 */
const nameMentionsOf = (doc: ProseDocument, prose: string, chars: VariantChars): NameMention[] => {
  const cues: NameCues = { leads: patternsOf(doc, "person-lead"), suffixes: patternsOf(doc, "person-suffix"), particles: patternsOf(doc, "name-particle") };
  const charReadings = charReadingsOf(doc);
  const tagged = doc.sentences.flatMap((sentence) => mentionsIn(sentence.tokens ?? [], doc.source, cues.suffixes, charReadings));
  const taggedOrSuffixed = [...tagged, ...suffixedNamesIn(prose, cues.suffixes, chars, tagged)];
  const cued = [...taggedOrSuffixed, ...cuedNamesIn(prose, cues, chars, taggedOrSuffixed)].map((mention): NameMention => {
    const cue = mention.cue ?? nameCueAt(prose, mention.offset, mention.surface, cues);
    return cue === undefined ? mention : { ...mention, cue };
  });
  return withKnownNeighbours(cued, prose).toSorted((left, right) => left.offset - right.offset);
};

/** 一語の名前の中で同じ音を書く字（ヶ・ケ・が）は語彙表 name-spelling-char が組（group）ごとに言う。 */
const spellingCharsOf = (doc: ProseDocument): VariantChars =>
  new Map((doc.lexicons["name-spelling-char"] ?? []).flatMap((entry): [string, string][] => (entry.group === undefined ? [] : [[entry.pattern, entry.group]])));

/** 名前の中の同じ音の字は、表の升の中の、解析器が固有名詞と読む語（物件名の升の 桜ケ丘）とも比べる。 */
const spellingInputOf = (doc: ProseDocument): SpellingInput => {
  const suffixes = patternsOf(doc, "person-suffix");
  return { chars: spellingCharsOf(doc), alsoWritten: cellsOf(doc).flatMap((cell) => mentionsIn(cell.tokens ?? [], doc.source, suffixes)) };
};

/** 表の升に書いた名前の書き分け。名前の形をした升を、本文の名前と比べる。ほかの見方がすでに指した所と重なるものは除く。 */
const tableFindings = (doc: ProseDocument, prose: string, mentions: readonly NameMention[], reported: readonly Reported[]): Reported[] =>
  cellNameVariants(cellNamesIn(cellsOf(doc), charReadingsOf(doc)), proseNamesOf(mentions, prose))
    .filter(({ name }) => !reported.some((other) => other.offset < name.offset + name.surface.length && name.offset < other.offset + other.name.length))
    .map(({ name, usual, kind }) => ({ offset: name.offset, name: name.surface, usual, kind }));

/** 同じ名前を、文書の中で少しだけ違う形に書いた所（GitHub と Github、山田太郎 と 山田太朗）。少ないほうを指す。 */
export const nameVariant: Detector = (doc): Finding[] => {
  const prose = doc.prose ?? doc.source;
  const chars = variantCharsOf(doc);
  const mentions = nameMentionsOf(doc, prose, chars);
  const names = nameVariants(mentions, chars, spellingInputOf(doc)).map(({ mention, usual, kind }): Reported => ({
    offset: mention.offset,
    name: mention.surface,
    usual,
    kind,
  }));
  const namesAndCompanies = [...names, ...companyFindings(doc, prose, names)];
  const withTables = [...namesAndCompanies, ...tableFindings(doc, prose, mentions, namesAndCompanies)];
  const withPlaces = [...withTables, ...placeFindings(doc, prose, withTables, chars)];
  const withProducts = [...withPlaces, ...productFindings(doc, prose, withPlaces)];
  const withOrder = [...withProducts, ...orderFindings(doc, prose, withProducts)];
  const codes = modelCodeFindings(doc, prose).filter((code) => !overlapsAny(withOrder, code.offset, code.name.length));
  return [...withOrder, ...codes]
    .toSorted((left, right) => left.offset - right.offset)
    .map(({ offset, name, usual, kind }) => ({
      rule: "",
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, offset),
      values: { name, usual, offset },
      variant: kind,
    }));
};
