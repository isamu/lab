// Party names listed in the reverse of the document's usual order (乙及び甲 where the contract otherwise writes 甲及び乙). The
// names are the parties the document defines and the language package's standard ones (party-order-label); the words that list
// them are its party-order-joiner list. A direction (乙から甲へ, 甲が乙に) is no listing and is not read.
import { definedTerms } from "../structure/definition-use.ts";
import { partiesOf } from "../structure/party-role.ts";
import { partyListings, reversedListings, type ListingWords } from "../structure/party-order.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding, ProseDocument } from "../plugin.ts";

/** The usual order is the one written at least this many times as often as its reverse: a tie or near-tie is no convention. */
const MIN_USUAL_RATIO = 2;
const SERIES_GROUP = "series";

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

const listingWords = (doc: ProseDocument): ListingWords => {
  const standard = patternsOf(doc, "party-order-label");
  const terms = doc.structure === undefined ? [] : definedTerms(doc.structure);
  const parties = partiesOf(doc.source, terms, {
    roles: patternsOf(doc, "party-role"),
    shortNames: patternsOf(doc, "party-short-name"),
    companyForms: patternsOf(doc, "company-form"),
  });
  const joiners = doc.lexicons["party-order-joiner"] ?? [];
  return {
    labels: [...new Set([...standard, ...parties.map((party) => party.term)])],
    bareLabels: standard,
    joiners: joiners.filter((entry) => entry.group !== SERIES_GROUP).map((entry) => entry.pattern),
    seriesMarks: joiners.filter((entry) => entry.group === SERIES_GROUP).map((entry) => entry.pattern),
  };
};

export const partyOrder: Detector = (doc): Finding[] => {
  const texts = doc.sentences.map((sentence) => ({ start: sentence.span.start, text: sentence.text }));
  const textOf = (listing: { readonly start: number; readonly end: number }): string => doc.source.slice(listing.start, listing.end);
  return reversedListings(partyListings(texts, listingWords(doc)), MIN_USUAL_RATIO).map((slip) => ({
    rule: "party-order",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, slip.listing.start),
    values: {
      written: textOf(slip.listing),
      usual: textOf(slip.usual),
      usualCount: slip.usualCount,
      reverseCount: slip.reverseCount,
      offset: slip.listing.start,
    },
  }));
};
