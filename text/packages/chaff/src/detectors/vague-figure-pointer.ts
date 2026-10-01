import type { Detector, Finding, Lexicon } from "../plugin.ts";
import { FIGURE_NUMBER, labelledKindsIn } from "../figure-references.ts";
import { escapeRegExp } from "../orthography.ts";
import { labelWordsOf } from "./dangling-figure.ts";
import { quoteAt } from "./structure-tree.ts";

// A figure or a table pointed at by where it is (上記の図, the table below) in a document that numbers that kind and
// could name it (図3, Table 2). JIS Z 8301:2019 10.6. The phrases and the kind each points at come from the lexicon.

export type VaguePointer = { readonly offset: number; readonly written: string; readonly kind: string };

/** A phrase inside a longer word (向上の図, 上の図表) is not one. */
const EDGE = "[\\p{Script=Han}\\p{Script=Katakana}A-Za-z0-9０-９]";

/** Matched in any case (The figure below). */
const pointerPattern = (pattern: string): RegExp => new RegExp(`(?<!${EDGE})${escapeRegExp(pattern)}(?!${EDGE})`, "giu");

/** A pointer followed by a number names the figure (上の図 １, the figure below 2, the table above IV): the numbers figure labels take. */
const NUMBERED = new RegExp(`^${FIGURE_NUMBER}`, "u");
/** Enough characters after a pointer to hold a figure's number (第十二, 3.2.1). */
const NUMBER_LOOKAHEAD = 16;

/** Pure: every pointer in the prose that points at a kind the document labels. */
export const vaguePointers = (prose: string, pointers: Lexicon, labelledKinds: ReadonlySet<string>): VaguePointer[] =>
  pointers
    .flatMap((entry) => {
      const kind = entry.instead_of;
      if (kind === undefined || !labelledKinds.has(kind)) return [];
      return [...prose.matchAll(pointerPattern(entry.pattern))]
        .filter((match) => !NUMBERED.test(prose.slice(match.index + match[0].length, match.index + match[0].length + NUMBER_LOOKAHEAD)))
        .map((match) => ({ offset: match.index, written: match[0], kind }));
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
