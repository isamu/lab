import type { Detector, Finding, Lexicon, LexiconEntry, OptionValue, Sentence } from "../plugin.ts";
import { entryCloses, entryIn, entryRanges, type TokenRange } from "./lexicon-match.ts";
import { QUOTATION_MARKS, isWithinAny, quotedIn } from "../quoted-span.ts";

// The verbal forms a house rule does not use for a provision: JIS Z 8301:2019's すべきである and a closing できる, or the
// Federal Plain Language Guidelines' "shall". Off until a team picks one; each choice reads one lexicon, which holds
// the forms and what to write instead (instead_of). A language without that lexicon has nothing to check.

/** The lexicons the rule's options turn on: requirement-modal-<standard>, and requirement-modal-must for shall: must. */
export const modalLexiconNames = (settings: Readonly<Record<string, OptionValue>>): string[] => [
  ...(typeof settings["standard"] === "string" && settings["standard"] !== "none" ? [`requirement-modal-${settings["standard"]}`] : []),
  ...(settings["shall"] === "must" ? ["requirement-modal-must"] : []),
];

type Use = { readonly entry: LexiconEntry; readonly offset: number };

const startOf = (sentence: Sentence, range: TokenRange | undefined): number =>
  range === undefined ? sentence.span.start : (sentence.tokens?.[range.start]?.span.start ?? sentence.span.start);

const spanOf = (sentence: Sentence, range: TokenRange): { start: number; end: number } => ({
  start: startOf(sentence, range),
  end: sentence.tokens?.[range.end - 1]?.span.end ?? sentence.span.end,
});

/** Where the words of the form are in the sentence: only the closing one for position: after, else every one. */
const candidateRanges = (sentence: Sentence, entry: LexiconEntry): TokenRange[] => {
  const ranges = entryRanges(sentence, entry);
  if (entry.position !== "after") return ranges;
  const closing = ranges.at(-1);
  return entryCloses(sentence, entry) && closing !== undefined ? [closing] : [];
};

/** Whether the sentence has the form at all, read on its text: for a sentence the adapter gave no tokens. */
const presentInText = (sentence: Sentence, entry: LexiconEntry): boolean =>
  entry.position === "after" ? entryCloses(sentence, entry) : entryIn(sentence, entry);

/**
 * Where the sentence uses the form, or undefined. A form with position: after must close the sentence. Either must stand
 * outside quotation marks: 'The key words "MUST" and "SHALL" …' and 禁止語は「べきである」。 mention a form, not use it.
 */
const useOf = (sentence: Sentence, entry: LexiconEntry): Use | undefined => {
  if (sentence.tokens === undefined) return presentInText(sentence, entry) ? { entry, offset: sentence.span.start } : undefined;
  const quoted = quotedIn(sentence, QUOTATION_MARKS);
  const used = candidateRanges(sentence, entry).find((range) => !isWithinAny(quoted, spanOf(sentence, range)));
  return used === undefined ? undefined : { entry, offset: startOf(sentence, used) };
};

const findingOf = (sentence: Sentence, use: Use): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: sentence.text.trim(),
  values: { matched: use.entry.pattern, preferred: use.entry.instead_of ?? "", offset: use.offset },
});

/** Each form of the lexicons the sentence uses. */
const formsIn = (sentence: Sentence, lexicon: Lexicon): Finding[] =>
  lexicon.flatMap((entry) => {
    const use = useOf(sentence, entry);
    return use === undefined ? [] : [findingOf(sentence, use)];
  });

export const requirementModal: Detector = (doc, options): Finding[] => {
  const lexicon = modalLexiconNames(options.settings ?? {}).flatMap((name) => doc.lexicons[name] ?? []);
  return lexicon.length === 0 ? [] : doc.sentences.flatMap((sentence) => formsIn(sentence, lexicon));
};
