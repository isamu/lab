// The heading words of a lab results table: lab-result-column, which every lab-table rule reads, then the words only one rule
// reads (its own lexicon).
import type { ProseDocument } from "../plugin.ts";
import { isLabColumn, type LabColumnWord } from "../structure/lab-columns.ts";

export const labColumnWordsOf = (doc: ProseDocument, ownLexicon: string): LabColumnWord[] =>
  [...(doc.lexicons["lab-result-column"] ?? []), ...(doc.lexicons[ownLexicon] ?? [])].flatMap((entry) =>
    isLabColumn(entry.group) ? [{ pattern: entry.pattern, column: entry.group }] : [],
  );
