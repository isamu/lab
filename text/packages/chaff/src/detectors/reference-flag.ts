// reference-flag-mismatch: the reading half (structure/reference-flags.ts). The column headings are lab-result-column's and
// reference-column-heading's, the flags reference-flag's, and a range is read with range-band-word and reference-bound-mark.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { referenceFlagSlips, type FlagMeaning, type ReferenceWords } from "../structure/reference-flags.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { labColumnWordsOf } from "./lab-columns.ts";
import { bandWordsOf } from "./range-band.ts";
import { quoteAt } from "./structure-tree.ts";

const isMeaning = (group: string | undefined): group is FlagMeaning => group === "high" || group === "low" || group === "normal" || group === "outside";

const wordsOf = (doc: ProseDocument): ReferenceWords => {
  const boundWords = [...(doc.lexicons["range-band-word"] ?? []), ...(doc.lexicons["reference-bound-mark"] ?? [])];
  const band = bandWordsOf({ ...doc.lexicons, "range-band-word": boundWords });
  return {
    headings: labColumnWordsOf(doc, "reference-column-heading"),
    flags: (doc.lexicons["reference-flag"] ?? []).flatMap((entry) => (isMeaning(entry.group) ? [{ pattern: entry.pattern, meaning: entry.group }] : [])),
    band: { ...band, units: [], headings: [] },
  };
};

export const referenceFlag: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  return referenceFlagSlips(text, wordsOf(doc)).map((slip) => {
    const offset = slip.flag.start + (slip.flag.text.length - slip.flag.text.trimStart().length);
    return {
      rule: "reference-flag-mismatch",
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(text, offset),
      ...(slip.kind === "inside" ? {} : { variant: slip.kind }),
      values: { item: slip.item, value: slip.value, range: slip.range, flag: slip.flag.text.trim(), offset },
    };
  });
};
