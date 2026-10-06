// version-mismatch: the version a code block's lead-in names against the one the block shows (structure/version-mismatch.ts).
// The words that make a version a bound (「から」「以上」, "from", "or later") are the lexicon version-range; the words that
// lead to the version installed (version, install) are version-lead.
import type { Detector, Finding } from "../plugin.ts";
import { versionMismatches, type RangeWord, type VersionWords } from "../structure/version-mismatch.ts";
import { codeFences } from "./code-fences.ts";
import { quoteAt } from "./structure-tree.ts";

export const versionMismatch: Detector = (doc): Finding[] => {
  const words: VersionWords = {
    ranges: (doc.lexicons["version-range"] ?? []).map((entry): RangeWord => ({ word: entry.pattern, position: entry.position ?? "before" })),
    versionWords: (doc.lexicons["version-lead"] ?? []).map((entry) => entry.pattern),
  };
  const blocks = codeFences(doc.source).map((fence) => ({ start: fence.start, code: fence.lines.join("\n") }));
  return versionMismatches(doc.source, doc.prose ?? doc.source, blocks, words).map((issue) => ({
    rule: "version-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
