// return-type-mismatch: one function's return type stated two ways on a page, the signature against a "Returns:" line, a
// table's return column or a sentence (return-type.ts). The words come from the return-label, return-verb, return-subject,
// return-type-word, return-clause and return-item lexicons.
import { quoteAt } from "./structure-tree.ts";
import { returnTypeClashes, type ReturnWords } from "../return-type.ts";
import type { Detector, Finding, Lexicon } from "../plugin.ts";

const patterns = (lexicon: Lexicon | undefined): string[] => (lexicon ?? []).map((entry) => entry.pattern);

const kindsOf = (lexicon: Lexicon | undefined): Map<string, string> =>
  new Map((lexicon ?? []).flatMap((entry): [string, string][] => (entry.group === undefined ? [] : [[entry.pattern, entry.group]])));

const wordsOf = (lexicons: Readonly<Record<string, Lexicon>>): ReturnWords => ({
  labels: patterns(lexicons["return-label"]),
  verbs: patterns(lexicons["return-verb"]),
  subjects: patterns(lexicons["return-subject"]),
  kinds: kindsOf(lexicons["return-type-word"]),
  clauses: patterns(lexicons["return-clause"]),
  items: patterns(lexicons["return-item"]),
});

export const returnType: Detector = (doc): Finding[] =>
  returnTypeClashes(doc.source, wordsOf(doc.lexicons)).map((clash) => ({
    rule: "return-type-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, clash.offset),
    values: { function: clash.fn, stated: clash.stated, signature: clash.signature, offset: clash.offset },
  }));
