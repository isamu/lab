// default-value-mismatch: one parameter's default stated two ways on a page (default-values.ts). The header words of a
// default column and the phrases that state a default in prose come from the default-header and default-phrase lexicons.
import { quoteAt } from "./structure-tree.ts";
import { defaultSlips } from "../default-values.ts";
import type { Detector, Finding, ProseDocument } from "../plugin.ts";

const lowercase = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern.toLowerCase());

export const defaultValues: Detector = (doc): Finding[] =>
  defaultSlips(doc.source, { headers: lowercase(doc, "default-header"), phrases: lowercase(doc, "default-phrase") }).map((slip) => ({
    rule: "default-value-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, slip.offset),
    values: { name: slip.name, value: slip.value, expected: slip.expected, offset: slip.offset },
  }));
