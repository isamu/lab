import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { mentionsIn, nameVariants, suffixedNamesIn, type VariantChars } from "../name-variants.ts";
import { quoteAt } from "./structure-tree.ts";

// 人の名前と読ませる敬称（様、さん）は語彙表 person-suffix、字体の違う同じ字（斎・斉・齋）は name-variant-char が組（group）ごとに言う。

const variantCharsOf = (doc: ProseDocument): VariantChars =>
  new Map((doc.lexicons["name-variant-char"] ?? []).flatMap((entry): [string, string][] => (entry.group === undefined ? [] : [[entry.pattern, entry.group]])));

/** 同じ名前を、文書の中で少しだけ違う形に書いた所（GitHub と Github、山田太郎 と 山田太朗）。少ないほうを指す。 */
export const nameVariant: Detector = (doc): Finding[] => {
  const suffixes = (doc.lexicons["person-suffix"] ?? []).map((entry) => entry.pattern);
  const chars = variantCharsOf(doc);
  const tagged = doc.sentences.flatMap((sentence) => mentionsIn(sentence.tokens ?? [], doc.source, suffixes));
  const mentions = [...tagged, ...suffixedNamesIn(doc.prose ?? doc.source, suffixes, chars, tagged)].toSorted((left, right) => left.offset - right.offset);
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
