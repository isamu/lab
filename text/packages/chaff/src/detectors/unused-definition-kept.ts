// unused-definition, less the terms that are not unused definitions: a wording quoted as what not to write (「風雨が強い」と
// はせずに …), which the definition reader takes for 「X」とは, and a term a heading names under another capitalisation
// (### Audio Content, then “Audio content” refers to …). The words after the quote come from the language's word list
// (rejected-wording). Pure.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { unusedDefinition } from "./definition-use.ts";

/** How far after the definition's start the term itself is looked for. */
const TERM_REACH = 40;
/** Closing quotes and spaces between the term and the words after it. */
const CLOSING = /^[」』”"'’\s]*/u;

/** Whether the quoted term is followed by words that reject it (「X」とはせずに、"X" should not be used). */
export const isRejectedWording = (source: string, offset: number, term: string, markers: readonly string[]): boolean => {
  const at = source.slice(offset, offset + TERM_REACH + term.length).indexOf(term);
  if (at === -1 || markers.length === 0) return false;
  const after = source.slice(offset + at + term.length).replace(CLOSING, "");
  return markers.some((marker) => after.startsWith(marker));
};

/** Whether a heading names the term, compared without case (### Audio Content and “Audio content”). */
export const isNamedByHeading = (term: string, headings: readonly string[]): boolean => {
  const word = new RegExp(String.raw`(?<![\p{L}\p{N}])${escapeRegExp(term.toLocaleLowerCase())}(?![\p{L}\p{N}])`, "u");
  return headings.some((heading) => word.test(heading.toLocaleLowerCase()));
};

const headingTexts = (doc: ProseDocument): string[] => (doc.markup?.headings ?? []).map((heading) => heading.text);

const isKept =
  (doc: ProseDocument, markers: readonly string[], headings: readonly string[]) =>
  (finding: Finding): boolean => {
    const term = String(finding.values["term"] ?? "");
    const offset = Number(finding.values["offset"] ?? 0);
    return !isRejectedWording(doc.source, offset, term, markers) && !isNamedByHeading(term, headings);
  };

export const unusedDefinitionKept: Detector = (doc, options): Finding[] => {
  const markers = (doc.lexicons["rejected-wording"] ?? []).map((entry) => entry.pattern);
  return unusedDefinition(doc, options).filter(isKept(doc, markers, headingTexts(doc)));
};
