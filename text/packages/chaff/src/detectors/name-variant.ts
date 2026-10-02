import type { Detector, Finding } from "../plugin.ts";
import { mentionsIn, nameVariants } from "../name-variants.ts";
import { quoteAt } from "./structure-tree.ts";

/** 同じ名前を、文書の中で少しだけ違う形に書いた所（GitHub と Github、山田太郎 と 山田太朗）。少ないほうを指す。 */
export const nameVariant: Detector = (doc): Finding[] =>
  nameVariants(doc.sentences.flatMap((sentence) => mentionsIn(sentence.tokens ?? [], doc.source))).map(({ mention, usual, kind }) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, mention.offset),
    values: { name: mention.surface, usual, offset: mention.offset },
    variant: kind,
  }));
