// unused-definition, less the terms that are not unused definitions: a wording quoted as what not to write (「風雨が強い」と
// はせずに …), which the definition reader takes for 「X」とは, and a term a heading names under another capitalisation
// (### Audio Content, then “Audio content” refers to …). The words after the quote come from the language's word list
// (rejected-wording). Nor is a quoted word a sentence asks about ("what “done” means"). Nor is a term defined for a unit of a code that the document is only one section of ("For the purpose
// of this subchapter—" in 5 U.S.C. 551): the other sections of the unit use it. Pure.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { unusedDefinition } from "./definition-use.ts";
import { scopedBeyondReader } from "./definition-scope-unit.ts";

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

/** Opening quotes and spaces between the words before the term and the term. */
const OPENING = new Set(["「", "『", "“", '"', "'", "‘"]);

const withoutOpening = (text: string): string => {
  const chars = [...text];
  return chars.slice(0, chars.findLastIndex((char) => !OPENING.has(char) && char.trim() !== "") + 1).join("");
};

/** The lead as a whole word at the end of the text before the term: "what", not "somewhat". */
const endsWithWord = (text: string, lead: string): boolean => text.endsWith(lead) && !/[\p{L}\p{N}]/u.test(text.at(-lead.length - 1) ?? "");

/**
 * Whether the quoted term follows a word that asks about it ("a definition of what “done” means"): the sentence asks
 * what the term means, and defines nothing. The words come from the language's word list (question-wording-lead).
 */
export const isQuestionedWording = (source: string, offset: number, term: string, leads: readonly string[]): boolean => {
  const at = source.slice(offset, offset + TERM_REACH + term.length).indexOf(term);
  if (at === -1 || leads.length === 0) return false;
  const before = withoutOpening(source.slice(Math.max(0, offset + at - TERM_REACH), offset + at)).toLowerCase();
  return leads.some((lead) => endsWithWord(before, lead.toLowerCase()));
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
  return doc.structure === undefined ? () => false : scopedBeyondReader(doc.structure, doc.source, leads, units);
};

const isKept =
  (doc: ProseDocument, headings: readonly string[]) =>
  (finding: Finding): boolean => {
    const term = String(finding.values["term"] ?? "");
    const offset = Number(finding.values["offset"] ?? 0);
    return (
      !isRejectedWording(doc.source, offset, term, patternsOf(doc, "rejected-wording")) &&
      !isQuestionedWording(doc.source, offset, term, patternsOf(doc, "question-wording-lead")) &&
      !isNamedByHeading(term, headings)
    );
  };

export const unusedDefinitionKept: Detector = (doc, options): Finding[] => {
  const beyond = scopedBeyond(doc);
  return unusedDefinition(doc, options)
    .filter(isKept(doc, headingTexts(doc)))
    .filter((finding) => !beyond(Number(finding.values["offset"] ?? 0)));
};
