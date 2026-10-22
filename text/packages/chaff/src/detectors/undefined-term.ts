// A term written as a defined term but defined nowhere: 本成果物 in a contract that defines 本業務 and 本契約 but no
// 本成果物. The document's own prefix for its defined terms (本, 本件: the language package's defined-term-prefix list)
// marks a word as one of its terms; a term with that prefix and no definition leaves the reader asking what it is.
// Only the document's own references (本条, 本契約: self-reference-noun and document-kind) are left. Pure; the parts of
// speech decide where a prefix is a prefix (本 in 本成果物) and not part of a word (本人, 本日).
import { definedTerms } from "../structure/definition-use.ts";
import { prefixGroupsOf, prefixVariants } from "../structure/term-prefix.ts";
import { quoteAt } from "./structure-tree.ts";
import { capitalisedTerms, namedWords, readableText, setApartSpans, type Defined } from "./capitalised-term.ts";
import type { Detector, Finding, ProseDocument, Token } from "../plugin.ts";

export type UndefinedTerm = { readonly offset: number; readonly term: string };

const NOUNS = new Set(["NOUN", "PROPN"]);
const QUOTE_PAIRS = [
  ["「", "」"],
  ["『", "』"],
  ['"', '"'],
  ["“", "”"],
] as const;

const isNoun = (token: Token | undefined): token is Token => token !== undefined && NOUNS.has(token.pos);

/** A defined term whose rest after the prefix is shorter than this (本人, 本日) is a word, not the document's way of naming terms. */
const MIN_REST = 2;

/** A prefix written right after a noun is inside a longer word, not a prefix. */
const continuesWord = (before: Token | undefined, token: Token): boolean => isNoun(before) && before.span.end === token.span.start;

/** The term a prefix token starts: the prefix and the nouns written right after it (本 成果 物). */
const termAt = (source: string, tokens: readonly Token[], index: number): { readonly offset: number; readonly term: string } | undefined => {
  const prefix = tokens[index];
  if (prefix === undefined) return undefined;
  const run = tokens.slice(index + 1);
  const length = run.findIndex((token, at) => !isNoun(token) || token.span.start !== (run[at - 1] ?? prefix).span.end);
  const last = run[(length === -1 ? run.length : length) - 1];
  return last === undefined ? undefined : { offset: prefix.span.start, term: source.slice(prefix.span.start, last.span.end) };
};

/** What the decision needs from the document and its word lists. */
export type TermWords = {
  readonly prefixes: readonly string[];
  readonly prefixGroups: readonly (readonly string[])[];
  /** What the document calls itself and its parts after a prefix (本条, 本契約, 本利用規約); never one of its terms. */
  readonly selfNouns: readonly string[];
  /** The term is set in quotes somewhere (「本情報」): defined in a form the structure did not read, or named on purpose. */
  readonly isQuoted: (term: string) => boolean;
  /** Terms the document names in a form the structure does not read as a definition: in quotes, or alone on a list item. */
  readonly named: readonly string[];
  /** What turns a term into another one (本報告書等 after 本報告書): a group the document has to define on its own. */
  readonly groupSuffixes: readonly string[];
};

const QUOTED = /[「『“"](?<term>[^「」『』“”"\n]{1,40})[」』”"]/gu;
/** An item's number: 2. or 2 and a space, ②, （2）. */
const ITEM_NUMBER = /^\s*(?:[0-9０-９]{1,3}[.．)）]?\s|[①-⑳]|[（(][0-9０-９]{1,3}[）)])/u;
const ONE_WORD = /^[^\s、。，．「」（）()]+$/u;

/** A list item holding one word (② 本報告書, 2. 本発明): the label of a definition list, its meaning in the next paragraph. */
const listLabelOf = (line: string): string | undefined => {
  const number = ITEM_NUMBER.exec(line);
  const rest = number === null ? "" : line.slice(number[0].length).trim();
  return ONE_WORD.test(rest) ? rest : undefined;
};

const hasPrefix = (term: string, prefixes: readonly string[]): boolean =>
  prefixes.some((prefix) => term.startsWith(prefix) && Array.from(term.slice(prefix.length)).length >= MIN_REST);

/** The prefixed terms the source names in quotes or alone on a list item, which the structure does not read as definitions. */
export const namedTerms = (source: string, prefixes: readonly string[]): string[] => {
  const given = prefixes.filter((prefix) => prefix !== "");
  const quoted = [...source.matchAll(QUOTED)].map((match) => match.groups?.["term"] ?? "");
  const labels = source.split("\n").flatMap((line) => listLabelOf(line) ?? []);
  return [...new Set([...quoted, ...labels].filter((term) => hasPrefix(term, given)))];
};

/** A use is a known form, or starts with one and goes on with more words (本報告書提出後), but not with a group's mark (本報告書等). */
const isKnownUse = (term: string, known: readonly string[], groupSuffixes: readonly string[]): boolean =>
  known.some((form) => form.startsWith(term) || (term.startsWith(form) && !groupSuffixes.includes(term.slice(form.length))));

/** The defined terms and their other-prefix forms (本件業務 for 本業務), which defined-term-form reads. */
const knownForms = (defined: readonly string[], groups: TermWords["prefixGroups"]): string[] => [
  ...defined,
  ...defined.flatMap((term) => prefixVariants(term, groups)),
];

/**
 * The first use of each term written with the document's prefix and defined nowhere, when the document defines at
 * least one term with that prefix (else the prefix is not its way of naming terms). A use that starts with a known
 * form (本サービス上 where 本サービス is defined) is that term, unless the rest is a group's mark (本サービス等).
 */
export const undefinedTerms = (source: string, sentences: readonly (readonly Token[])[], defined: readonly string[], words: TermWords): UndefinedTerm[] => {
  const prefixes = words.prefixes.filter((prefix) => prefix !== "");
  if (!defined.some((term) => hasPrefix(term, prefixes))) return [];
  const isSelf = (term: string, prefix: string): boolean => {
    const rest = term.slice(prefix.length);
    return words.selfNouns.some((noun) => noun !== "" && (rest.startsWith(noun) || rest.endsWith(noun)));
  };
  const runs = sentences.flatMap((tokens) =>
    tokens.flatMap((token, index) => {
      if (!prefixes.includes(token.surface) || !isNoun(tokens[index + 1]) || continuesWord(tokens[index - 1], token)) return [];
      const use = termAt(source, tokens, index);
      return use === undefined ? [] : [{ ...use, prefix: token.surface }];
    }),
  );
  // A name that does not start a run of nouns (② 本研究の具体的な遂行方法) is an item of a list, not a term.
  const named = words.named.filter((term) => runs.some((run) => run.term.startsWith(term)));
  const known = knownForms([...defined, ...named], words.prefixGroups);
  const uses = runs
    .filter((run) => !isSelf(run.term, run.prefix) && !words.isQuoted(run.term) && !isKnownUse(run.term, known, words.groupSuffixes))
    .map((run) => ({ offset: run.offset, term: run.term }));
  return uses.filter((use, index) => uses.findIndex((other) => other.term === use.term) === index);
};

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

/** The words of one group of a lexicon; undefined: the entries with no group. */
const groupOf = (doc: ProseDocument, lexicon: string, group: string | undefined): string[] =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => entry.group === group).map((entry) => entry.pattern);

const ATTACHED = "attached-document-cue";

const findingOf = (doc: ProseDocument, use: UndefinedTerm): Finding => ({
  rule: "undefined-term",
  severity: "info",
  line: 0,
  column: 0,
  quote: quoteAt(doc.source, use.offset),
  values: { term: use.term, offset: use.offset },
});

const NAME_LISTS = ["proper-name-word", "place-region", "calendar-name", "month-name", "company-form", "party-role"] as const;
/** The lists whose words end a name right after a comma (Post Holdings, Inc.; Canton, Ohio). */
const FORM_ENDS = ["company-form", "place-region"] as const;

/** Capitalised terms, for a language whose package lists the words that join one name (name-joiner); Japanese has none. */
const capitalisedUses = (doc: ProseDocument, sentences: readonly (readonly Token[])[], defined: readonly Defined[]): UndefinedTerm[] => {
  if (doc.lexicons["name-joiner"] === undefined) return [];
  const words = {
    names: NAME_LISTS.flatMap((id) => patternsOf(doc, id)),
    divisions: patternsOf(doc, "numbered-division"),
    joiners: patternsOf(doc, "name-joiner"),
    nameEnds: patternsOf(doc, "proper-name-word"),
    formEnds: FORM_ENDS.flatMap((id) => patternsOf(doc, id)),
    definitionMarkers: patternsOf(doc, "definition-marker"),
    definedElsewhere: patternsOf(doc, "defined-elsewhere"),
    capacityMarkers: patternsOf(doc, "capacity-marker"),
    articles: patternsOf(doc, "article"),
    attachedCues: groupOf(doc, ATTACHED, undefined),
    attachedTitleEnds: groupOf(doc, ATTACHED, "title-end"),
  };
  const marked = [...(doc.markup?.headings ?? []), ...doc.links, ...setApartSpans(doc.source)];
  return capitalisedTerms({ source: doc.source, readable: readableText(doc.source), sentences, defined, named: namedWords(doc.source), marked, words });
};

export const undefinedTerm: Detector = (doc): Finding[] => {
  if (doc.structure === undefined) return [];
  const prefixEntries = doc.lexicons["defined-term-prefix"] ?? [];
  const sentences = doc.sentences.map((sentence) => sentence.tokens ?? []);
  const definitions = definedTerms(doc.structure);
  const defined = definitions.map((term) => term.term);
  const prefixes = prefixEntries.map((entry) => entry.pattern);
  const prefixed = undefinedTerms(doc.source, sentences, defined, {
    prefixes,
    prefixGroups: prefixGroupsOf(prefixEntries),
    selfNouns: [...patternsOf(doc, "self-reference-noun"), ...patternsOf(doc, "document-kind")],
    isQuoted: (term) => QUOTE_PAIRS.some(([open, close]) => doc.source.includes(`${open}${term}${close}`)),
    named: namedTerms(doc.source, prefixes),
    groupSuffixes: patternsOf(doc, "defined-term-group-suffix"),
  });
  return [...prefixed, ...capitalisedUses(doc, sentences, definitions)].map((use) => findingOf(doc, use));
};
