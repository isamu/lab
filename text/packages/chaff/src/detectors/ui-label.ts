// ui-label-variant: one label on the screen written two ways in a manual (ui-labels.ts). The words a label is written with or
// without come from the language's label-particle lexicon.
import { quoteAt } from "./structure-tree.ts";
import { labelsIn, labelVariants } from "../ui-labels.ts";
import type { Detector, Finding } from "../plugin.ts";

export const uiLabel: Detector = (doc): Finding[] => {
  const particles = (doc.lexicons["label-particle"] ?? []).map((entry) => entry.pattern);
  return labelVariants(labelsIn(doc.source, doc.prose ?? doc.source), particles).map(({ label, usual }) => ({
    rule: "ui-label-variant",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, label.offset),
    values: { written: label.surface, usual, offset: label.offset },
  }));
};
