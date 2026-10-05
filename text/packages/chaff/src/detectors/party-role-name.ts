// A party called by a role word (受託者, the Vendor) after the contract gave it a short name (乙, the "Supplier"). The
// definitions come from the document's structure tree; the role words, short names and company forms from the language
// package's word lists (party-role, party-short-name, company-form).
import { definedTerms } from "../structure/definition-use.ts";
import { partiesOf, roleUses } from "../structure/party-role.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding, ProseDocument } from "../plugin.ts";

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

/** The sentence holding a definition: the role words in the sentences that name the parties are part of naming them. */
const sentenceAt = (doc: ProseDocument, offset: number): { readonly start: number; readonly end: number } =>
  doc.sentences.find((sentence) => sentence.span.start <= offset && offset < sentence.span.end)?.span ?? { start: offset, end: offset };

const NAME_SEPARATOR: Readonly<Record<string, string>> = { ja: "、" };

export const partyRoleName: Detector = (doc): Finding[] => {
  if (doc.structure === undefined) return [];
  const terms = definedTerms(doc.structure);
  const words = { roles: patternsOf(doc, "party-role"), shortNames: patternsOf(doc, "party-short-name"), companyForms: patternsOf(doc, "company-form") };
  const parties = partiesOf(doc.source, terms, words);
  if (parties.length === 0) return [];
  // From the sentence that names the first party: a party named later (a subcontractor ("Recipient")) does not hide the role words before it.
  const naming = parties.map((party) => sentenceAt(doc, party.end - 1));
  const after = Math.min(...naming.map((sentence) => sentence.end));
  const names = [...new Set(parties.map((party) => party.term))].join(NAME_SEPARATOR[doc.language] ?? ", ");
  const texts = doc.sentences.map((sentence) => ({ start: sentence.span.start, text: sentence.text }));
  return roleUses(
    doc.source,
    texts,
    words.roles,
    terms.map((term) => term.term),
    after,
  )
    .filter((use) => !naming.some((sentence) => sentence.start <= use.offset && use.offset < sentence.end))
    .map((use) => ({
      rule: "party-role-name",
      severity: "info",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, use.offset),
      values: { role: use.role, names, offset: use.offset },
    }));
};
