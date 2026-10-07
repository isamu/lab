import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { cuedNamesIn, mentionsIn, nameVariants, suffixedNamesIn, type NameMention, type VariantChars } from "../name-variants.ts";
import { nameCueAt, type NameCues } from "../name-cue.ts";
import { quoteAt } from "./structure-tree.ts";

// 人の名前と読ませる敬称（様、さん）は語彙表 person-suffix、人を指す前置き（担当の）は person-lead、名前のすぐ後ろに来る語
// （です、まで）は name-particle、字体の違う同じ字（斎・斉・齋）は name-variant-char が組（group）ごとに言う。

const variantCharsOf = (doc: ProseDocument): VariantChars =>
  new Map((doc.lexicons["name-variant-char"] ?? []).flatMap((entry): [string, string][] => (entry.group === undefined ? [] : [[entry.pattern, entry.group]])));

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

/** 同じ名前を、文書の中で少しだけ違う形に書いた所（GitHub と Github、山田太郎 と 山田太朗）。少ないほうを指す。 */
export const nameVariant: Detector = (doc): Finding[] => {
  const cues: NameCues = { leads: patternsOf(doc, "person-lead"), suffixes: patternsOf(doc, "person-suffix"), particles: patternsOf(doc, "name-particle") };
  const prose = doc.prose ?? doc.source;
  const chars = variantCharsOf(doc);
  const tagged = doc.sentences.flatMap((sentence) => mentionsIn(sentence.tokens ?? [], doc.source, cues.suffixes));
  const taggedOrSuffixed = [...tagged, ...suffixedNamesIn(prose, cues.suffixes, chars, tagged)];
  const mentions = [...taggedOrSuffixed, ...cuedNamesIn(prose, cues, chars, taggedOrSuffixed)]
    .map((mention): NameMention => {
      const cue = mention.cue ?? nameCueAt(prose, mention.offset, mention.surface, cues);
      return cue === undefined ? mention : { ...mention, cue };
    })
    .toSorted((left, right) => left.offset - right.offset);
  return nameVariants(mentions, chars).map(({ mention, usual, kind }) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, mention.offset),
    values: { name: mention.surface, usual, offset: mention.offset },
    variant: kind,
  }));
};
