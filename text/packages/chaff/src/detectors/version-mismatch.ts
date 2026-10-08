// version-mismatch: the version a code block's lead-in names against the one the block shows (structure/version-mismatch.ts),
// and an install command that pins the document's own package to a version its release list does not say is current
// (structure/install-pin.ts). The words that make a version a bound (「から」「以上」, "from", "or later") are the lexicon
// version-range; the words that lead to the version installed (version, install) are version-lead; the install commands
// are install-command.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { versionMismatches, type RangeWord, type VersionWords } from "../structure/version-mismatch.ts";
import { installPinMismatches, ownTextOf, pinsIn } from "../structure/install-pin.ts";
import { releasesOf } from "../structure/release-list.ts";
import { codeFences } from "./code-fences.ts";
import { quoteAt } from "./structure-tree.ts";

const leadInFindings = (doc: ProseDocument): Finding[] => {
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

const installPinFindings = (doc: ProseDocument): Finding[] => {
  const shapes = (doc.lexicons["install-command"] ?? []).map((entry) => entry.pattern);
  const headings = doc.markup?.headings ?? [];
  const releases = releasesOf(doc.source, headings, codeFences(doc.source));
  return installPinMismatches(pinsIn(doc.source, shapes), releases, ownTextOf(doc.source, headings)).map((issue) => ({
    rule: "version-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    variant: issue.variant,
    values: { ...issue.values, offset: issue.offset },
  }));
};

export const versionMismatch: Detector = (doc): Finding[] => [...leadInFindings(doc), ...installPinFindings(doc)];
