// Where in a sentence orthographic-variant reads the writer's own spelling: outside what keeps a spelling of its own (a
// quotation, a name, a cited title) and outside what is not a spelling at all (a reading in brackets, a label).

import type { ProseDocument, Sentence, Span } from "../plugin.ts";
import { externalLinkTitleSpans } from "../link-title.ts";
import { QUOTATION_MARKS, isWithinAny, quotedSpans } from "../quoted-span.ts";
import { singleQuotedSpans } from "../single-quoted-span.ts";
import { nameSpans, touchesAny } from "../team-names.ts";
import { furiganaSpans } from "../furigana.ts";
import { contactEntrySpans } from "../contact-entry.ts";
import { japaneseCompanyNameSpans } from "../company-name-run.ts";
import { leadingLabelSpans } from "../leading-label.ts";
import { mentionedSpellingSpans } from "../spelling-mention.ts";
import { quoteGlossSpans } from "../quote-gloss.ts";
import { lawTitleSpans } from "../law-title.ts";
import { referenceListSpans } from "../reference-lists.ts";
import { citationLead } from "./citation-sentence.ts";
import { acronymExpansionSpans } from "../acronym-expansion.ts";
import { nameEndingRuns, namesWrittenOneWay } from "../name-ending-run.ts";
import { entriesForGenre } from "../lexicon-genres.ts";

export type IsOpen = (start: number, end: number) => boolean;

const SPELLING_MENTION = "spelling-mention";
const COMPANY_FORM = "company-form";
/** Lexicon: words that close a facility's or an organisation's name (動物園, センター): the nouns before them are the name's. */
const NAME_ENDING = "orthographic-variant-name-ending";
/** Lexicon: a statute's number in brackets (（平成20年法律第83号）), as regular expressions: the title before it is the statute's. */
const LAW_NUMBER = "orthographic-variant-law-number";
/** Lexicon shared with other rules: the headings of a reference list. */
const REFERENCE_LIST_HEADING = "reference-list-heading";

/** A lexicon's entries that hold for the genre. */
export const patternsOf = (doc: ProseDocument, id: string, genre: string | undefined): string[] =>
  entriesForGenre(doc.lexicons[id] ?? [], genre).map((entry) => entry.pattern);

/** Every entry of a lexicon, whatever its genres. */
const allPatternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

/**
 * The team's names, the company forms (株式会社, ㈱) a registered company name is written next to, the links that quote an
 * outside page's title (link-title.ts) and the reference lists, placed in the source, and the words that close a name or
 * number a statute.
 */
export type Names = {
  readonly team: readonly string[];
  readonly companyForms: readonly string[];
  readonly linkTitles: readonly Span[];
  /** Quotations in single quotation marks (an opinion quoting a statute), placed in the source: they can span sentences. */
  readonly singleQuoted: readonly Span[];
  /** Phrases that say a word is also spelled another way (とも書く): the bracketed words before them are spellings mentioned. */
  readonly mentions: readonly string[];
  /** Reference lists: their entries are cited works, spelled as their authors spelled them. */
  readonly referenceLists: readonly Span[];
  readonly lawNumbers: readonly RegExp[];
  readonly nameEndings: readonly string[];
  /** The facilities' and organisations' names the document writes one way only (こども動物園). */
  readonly oneWayNames: ReadonlySet<string>;
};

export const namesOf = (doc: ProseDocument, genre: string | undefined): Names => ({
  team: doc.names ?? [],
  companyForms: allPatternsOf(doc, COMPANY_FORM),
  linkTitles: externalLinkTitleSpans(doc.source, doc.links),
  singleQuoted: singleQuotedSpans(doc.source),
  mentions: allPatternsOf(doc, SPELLING_MENTION),
  referenceLists: referenceListSpans(doc.source, allPatternsOf(doc, REFERENCE_LIST_HEADING)),
  lawNumbers: patternsOf(doc, LAW_NUMBER, genre).map((pattern) => new RegExp(pattern, "u")),
  nameEndings: patternsOf(doc, NAME_ENDING, genre),
  oneWayNames: namesWrittenOneWay(
    [...doc.sentences, ...(doc.tableCells?.() ?? [])].flatMap(({ tokens }) => nameEndingRuns(tokens ?? [], patternsOf(doc, NAME_ENDING, genre))),
  ),
});

/** Spans placed in the source, placed in a sentence's text instead. */
const inSentence = (sentence: Sentence, spans: readonly Span[]): Span[] =>
  spans.map((span) => ({ start: span.start - sentence.span.start, end: span.end - sentence.span.start }));

/** The reference a sentence cites (See John Kay and Mervyn King (2020), Radical Uncertainty: …): from its year on, the cited work's words. */
const citationSpans = (text: string): Span[] => {
  const lead = citationLead(text, []);
  return lead === undefined ? [] : [{ start: text.indexOf(lead) + lead.length, end: text.length }];
};

/** A sentence's cited works: a reference list's entry, and the reference a sentence cites. Their Latin words are read with care (quoted-spelling.ts). */
export const citedSpans = (sentence: Sentence, names: Names): Span[] => [...inSentence(sentence, names.referenceLists), ...citationSpans(sentence.text)];

/** What keeps a spelling of its own: a quotation's gloss, a statute's title, an acronym's expansion, a facility's name. */
const ownSpellingSpans = (sentence: Sentence, names: Names): Span[] => [
  ...quoteGlossSpans(sentence.text),
  ...lawTitleSpans(sentence.text, names.lawNumbers),
  ...acronymExpansionSpans(sentence.text),
  ...inSentence(
    sentence,
    nameEndingRuns(sentence.tokens ?? [], names.nameEndings).filter((name) => names.oneWayNames.has(name.written)),
  ),
];

/**
 * Whether a stretch of the sentence is outside a quotation, the team's names, a company's name (関東珪曹硝子㈱), a reading in
 * brackets (HTTP（えいちてぃーてぃーぴー）), a label opening the sentence (（答）), a spelling mentioned (（曇）とも書く), a
 * contact's name beside its phone number and what keeps a spelling of its own: a reading is not a spelling at all, a label is a
 * fixed short form, a mention is the subject, and the rest keep their own spelling.
 */
export const isOpenIn = (sentence: Sentence, names: Names): IsOpen => {
  const closed = [
    ...quotedSpans(sentence.text, QUOTATION_MARKS),
    ...furiganaSpans(sentence.text),
    ...contactEntrySpans(sentence.text),
    ...japaneseCompanyNameSpans(sentence.text, names.companyForms),
    ...inSentence(sentence, names.linkTitles),
    ...inSentence(sentence, names.singleQuoted),
    ...leadingLabelSpans(sentence.text),
    ...mentionedSpellingSpans(sentence.text, names.mentions),
    ...ownSpellingSpans(sentence, names),
  ];
  const named = nameSpans(sentence.text, names.team);
  return (start, end) => !isWithinAny(closed, { start, end }) && !touchesAny(named, start, end);
};
