import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { cuedNamesIn, mentionsIn, nameVariants, suffixedNamesIn, withKnownNeighbours, type NameMention, type VariantChars } from "../name-variants.ts";
import { nameCueAt, type NameCues } from "../name-cue.ts";
import { quoteAt } from "./structure-tree.ts";
import { companyMentionsIn, companyVariants, type CompanyForm, type IsProper } from "../company-names.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { tableBodyCells } from "../facts/table-facts.ts";
import { cellNamesIn, cellNameVariants, proseNamesOf } from "../table-names.ts";

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

type Reported = { readonly offset: number; readonly name: string; readonly usual: string; readonly kind: string };

/** 会社の名前の書き分け。名前の見方がすでに指した所と重なるものは除く。 */
const companyFindings = (doc: ProseDocument, prose: string, reported: readonly Reported[]): Reported[] =>
  companyVariants(companyMentionsIn(prose, companyFormsOf(doc), properOf(doc)))
    .filter(
      ({ mention }) => !reported.some((other) => other.offset < mention.offset + mention.surface.length && mention.offset < other.offset + other.name.length),
    )
    .map(({ mention, usual, kind }) => ({ offset: mention.offset, name: mention.surface, usual, kind: kind === "spelling" ? kind : `company-${kind}` }));

/** 人・製品・会社の名前の現れ。解析器が固有名詞と読む語、敬称の付く名前、前後の語で名前と読める漢字。 */
const nameMentionsOf = (doc: ProseDocument, prose: string, chars: VariantChars): NameMention[] => {
  const cues: NameCues = { leads: patternsOf(doc, "person-lead"), suffixes: patternsOf(doc, "person-suffix"), particles: patternsOf(doc, "name-particle") };
  const tagged = doc.sentences.flatMap((sentence) => mentionsIn(sentence.tokens ?? [], doc.source, cues.suffixes));
  const taggedOrSuffixed = [...tagged, ...suffixedNamesIn(prose, cues.suffixes, chars, tagged)];
  const cued = [...taggedOrSuffixed, ...cuedNamesIn(prose, cues, chars, taggedOrSuffixed)].map((mention): NameMention => {
    const cue = mention.cue ?? nameCueAt(prose, mention.offset, mention.surface, cues);
    return cue === undefined ? mention : { ...mention, cue };
  });
  return withKnownNeighbours(cued, prose).toSorted((left, right) => left.offset - right.offset);
};

/**
 * 表の升に書いた名前の書き分け。升は品詞解析を通らないので、名前の形をした升を本文の名前と比べる。ほかの見方がすでに指した所と
 * 重なるものは除く。
 */
const tableFindings = (doc: ProseDocument, prose: string, mentions: readonly NameMention[], reported: readonly Reported[]): Reported[] =>
  cellNameVariants(cellNamesIn(tableBodyCells(proseAndTablesOf(doc))), proseNamesOf(mentions, prose))
    .filter(({ name }) => !reported.some((other) => other.offset < name.offset + name.surface.length && name.offset < other.offset + other.name.length))
    .map(({ name, usual, kind }) => ({ offset: name.offset, name: name.surface, usual, kind }));

/** 同じ名前を、文書の中で少しだけ違う形に書いた所（GitHub と Github、山田太郎 と 山田太朗）。少ないほうを指す。 */
export const nameVariant: Detector = (doc): Finding[] => {
  const prose = doc.prose ?? doc.source;
  const chars = variantCharsOf(doc);
  const mentions = nameMentionsOf(doc, prose, chars);
  const names = nameVariants(mentions, chars).map(({ mention, usual, kind }): Reported => ({
    offset: mention.offset,
    name: mention.surface,
    usual,
    kind,
  }));
  const namesAndCompanies = [...names, ...companyFindings(doc, prose, names)];
  return [...namesAndCompanies, ...tableFindings(doc, prose, mentions, namesAndCompanies)]
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
