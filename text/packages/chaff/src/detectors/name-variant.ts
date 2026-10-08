import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { cuedNamesIn, mentionsIn, nameVariants, suffixedNamesIn, type NameMention, type VariantChars } from "../name-variants.ts";
import { nameCueAt, type NameCues } from "../name-cue.ts";
import { quoteAt } from "./structure-tree.ts";
import { companyMentionsIn, companyVariants, type CompanyForm, type IsProper } from "../company-names.ts";
import { placeMentionsIn, placeVariants, type PlaceReader, type PlaceWord } from "../place-names.ts";
import type { Token } from "../plugin.ts";

// 人の名前と読ませる敬称（様、さん）は語彙表 person-suffix、人を指す前置き（担当の）は person-lead、名前のすぐ後ろに来る語
// （です、まで）は name-particle、字体の違う同じ字（斎・斉・齋）は name-variant-char が組（group）ごとに言う。

const variantCharsOf = (doc: ProseDocument): VariantChars =>
  new Map((doc.lexicons["name-variant-char"] ?? []).flatMap((entry): [string, string][] => (entry.group === undefined ? [] : [[entry.pattern, entry.group]])));

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

/** 名前の頭に立たない語の品詞（The、at、and）。 */
const FUNCTION_POS: ReadonlySet<string> = new Set(["DET", "ADP", "PRON", "CCONJ", "SCONJ", "AUX", "PART"]);

const tokensOf = (doc: ProseDocument): Token[] => doc.sentences.flatMap((sentence) => sentence.tokens ?? []);

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

/** 会社の名前の書き分け。名前の見方がすでに指した所と重なるものは除く。 */
const companyFindings = (doc: ProseDocument, prose: string, reported: readonly Reported[]): Reported[] =>
  companyVariants(companyMentionsIn(prose, companyFormsOf(doc), properOf(doc)))
    .filter(({ mention }) => !overlapsAny(reported, mention.offset, mention.surface.length))
    .map(({ mention, usual, kind }) => ({ offset: mention.offset, name: mention.surface, usual, kind: kind === "spelling" ? kind : `company-${kind}` }));

/** 場所の名前の書き分け。人や会社の名前の見方がすでに指した所と重なるものは除く。 */
const placeFindings = (doc: ProseDocument, prose: string, reported: readonly Reported[]): Reported[] =>
  placeVariants(placeMentionsIn(prose, placeWordsOf(doc), placeReaderOf(doc)))
    .filter(({ mention }) => !overlapsAny(reported, mention.offset, mention.surface.length))
    .map(({ mention, usual, kind }) => ({ offset: mention.offset, name: mention.surface, usual, kind }));

/** 人・製品・会社の名前の現れ。解析器が固有名詞と読む語、敬称の付く名前、前後の語で名前と読める漢字。 */
const nameMentionsOf = (doc: ProseDocument, prose: string, chars: VariantChars): NameMention[] => {
  const cues: NameCues = { leads: patternsOf(doc, "person-lead"), suffixes: patternsOf(doc, "person-suffix"), particles: patternsOf(doc, "name-particle") };
  const tagged = doc.sentences.flatMap((sentence) => mentionsIn(sentence.tokens ?? [], doc.source, cues.suffixes));
  const taggedOrSuffixed = [...tagged, ...suffixedNamesIn(prose, cues.suffixes, chars, tagged)];
  return [...taggedOrSuffixed, ...cuedNamesIn(prose, cues, chars, taggedOrSuffixed)]
    .map((mention): NameMention => {
      const cue = mention.cue ?? nameCueAt(prose, mention.offset, mention.surface, cues);
      return cue === undefined ? mention : { ...mention, cue };
    })
    .toSorted((left, right) => left.offset - right.offset);
};

/** 同じ名前を、文書の中で少しだけ違う形に書いた所（GitHub と Github、山田太郎 と 山田太朗）。少ないほうを指す。 */
export const nameVariant: Detector = (doc): Finding[] => {
  const prose = doc.prose ?? doc.source;
  const chars = variantCharsOf(doc);
  const names = nameVariants(nameMentionsOf(doc, prose, chars), chars).map(({ mention, usual, kind }): Reported => ({
    offset: mention.offset,
    name: mention.surface,
    usual,
    kind,
  }));
  const namesAndCompanies = [...names, ...companyFindings(doc, prose, names)];
  return [...namesAndCompanies, ...placeFindings(doc, prose, namesAndCompanies)]
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
