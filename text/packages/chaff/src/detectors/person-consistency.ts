import type { Detector, Finding, ProseDocument, Sentence } from "../plugin.ts";
import { personMentions, personMinorities, type PersonMention, type PersonWords } from "../person-forms.ts";

const wordsOf = (doc: ProseDocument, words: PersonWords["words"]): PersonWords => ({
  words,
  forms: doc.lexicons["person-form"] ?? [],
  notAfter: doc.lexicons["person-not-after"] ?? [],
});

/**
 * One document naming itself (私たち / 弊社, 私 / 筆者) or its reader (you / one) two ways: the minority form of each slot.
 * Sentences in another language than the document's are left out; quotations are left out by personMentions.
 */
export const personMix: Detector = (doc, options): Finding[] => {
  const person = wordsOf(doc, options.lexicon ?? []);
  const entries: { readonly sentence: Sentence; readonly mention: PersonMention }[] = doc.sentences
    .filter((sentence) => sentence.embeddedLanguage === undefined)
    .flatMap((sentence) => personMentions(sentence.text, person).map((mention) => ({ sentence, mention })));
  return personMinorities(entries, options.limit).flatMap(({ odd, usual, of }) =>
    odd.map(({ sentence, mention }) => ({
      rule: "",
      severity: "info" as const,
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { matched: mention.written, usual, count: odd.length, of, limit: options.limit, offset: sentence.span.start + mention.at },
    })),
  );
};
