// unused-definition, less the terms that are not unused definitions: a wording quoted as what not to write (「風雨が強い」と
// はせずに …), which the definition reader takes for 「X」とは, and a term a heading names under another capitalisation
// (### Audio Content, then “Audio content” refers to …). The words after the quote come from the language's word list
// (rejected-wording). Nor is a term defined for a unit of a code that the document is only one section of ("For the purpose
// of this subchapter—" in 5 U.S.C. 551): the other sections of the unit use it. Pure.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { unusedDefinition } from "./definition-use.ts";
import { scopedBeyondDocument } from "./definition-scope-unit.ts";

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

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

/** Whether the definition at `offset` is made for a unit of a code the document does not have. */
const scopedBeyond = (doc: ProseDocument): ((offset: number) => boolean) => {
  const leads = patternsOf(doc, "definition-scope-lead");
  const units = new Set(patternsOf(doc, "enclosing-unit").map((unit) => unit.toLowerCase()));
  return (offset) => doc.structure !== undefined && scopedBeyondDocument(doc.structure, doc.source, offset, leads, units);
};

const isKept =
  (doc: ProseDocument, markers: readonly string[], headings: readonly string[]) =>
  (finding: Finding): boolean => {
    const term = String(finding.values["term"] ?? "");
    const offset = Number(finding.values["offset"] ?? 0);
    return !isRejectedWording(doc.source, offset, term, markers) && !isNamedByHeading(term, headings);
  };

export const unusedDefinitionKept: Detector = (doc, options): Finding[] => {
  const beyond = scopedBeyond(doc);
  return unusedDefinition(doc, options)
    .filter(isKept(doc, patternsOf(doc, "rejected-wording"), headingTexts(doc)))
    .filter((finding) => !beyond(Number(finding.values["offset"] ?? 0)));
};
