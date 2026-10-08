// deprecated-option-used: a name the document calls deprecated, still used in one of its code examples
// (deprecated-use.ts). The words come from the deprecation-word and deprecation-negated lexicons.
import { quoteAt } from "./structure-tree.ts";
import { deprecatedUses } from "../deprecated-use.ts";
import type { Detector, Finding, ProseDocument } from "../plugin.ts";

const lowercase = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern.toLowerCase());

export const deprecatedUse: Detector = (doc): Finding[] =>
  deprecatedUses(doc.source, { words: lowercase(doc, "deprecation-word"), negated: lowercase(doc, "deprecation-negated") }).map((use) => ({
    rule: "deprecated-option-used",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, use.offset),
    values: { name: use.name, offset: use.offset },
  }));
