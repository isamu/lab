import type { Detector, Finding, Lexicon } from "../plugin.ts";
import { labelledKindsIn } from "../figure-references.ts";
import { escapeRegExp } from "../orthography.ts";
import { labelWordsOf } from "./dangling-figure.ts";
import { quoteAt } from "./structure-tree.ts";

// A figure or a table pointed at by where it is (上記の図, the table below) in a document that numbers that kind and
// could name it (図3, Table 2). JIS Z 8301:2019 10.6. The phrases and the kind each points at come from the lexicon.

export type VaguePointer = { readonly offset: number; readonly written: string; readonly kind: string };

/** A phrase inside a longer word (向上の図, 上の図表) or followed by a number (上の図3, the figure above 2) is not one. */
const EDGE = "[\\p{Script=Han}\\p{Script=Katakana}A-Za-z0-9０-９]";

const pointerPattern = (pattern: string): RegExp => new RegExp(`(?<!${EDGE})${escapeRegExp(pattern)}(?!${EDGE}|\\s?\\d)`, "giu");

/** Pure: every pointer in the prose that points at a kind the document labels. */
export const vaguePointers = (prose: string, pointers: Lexicon, labelledKinds: ReadonlySet<string>): VaguePointer[] =>
  pointers
    .flatMap((entry) => {
      const kind = entry.instead_of;
      if (kind === undefined || !labelledKinds.has(kind)) return [];
      return [...prose.matchAll(pointerPattern(entry.pattern))].map((match) => ({ offset: match.index, written: match[0], kind }));
    })
    .toSorted((left, right) => left.offset - right.offset);

export const vagueFigurePointer: Detector = (doc): Finding[] => {
  const kinds = labelledKindsIn(doc.source, labelWordsOf(doc));
  return vaguePointers(doc.prose ?? doc.source, doc.lexicons["vague-figure-pointer"] ?? [], kinds).map((pointer) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, pointer.offset),
    values: { matched: pointer.written, kind: pointer.kind, offset: pointer.offset },
  }));
};
