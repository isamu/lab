import type { Detector, Finding, ProseDocument, Sentence } from "../plugin.ts";
import { personMentions, personMinorities, withoutOtherSenses, type PersonMention, type PersonWords } from "../person-forms.ts";

const wordsOf = (doc: ProseDocument, words: PersonWords["words"]): PersonWords => ({
  words,
  forms: doc.lexicons["person-form"] ?? [],
  notAfter: doc.lexicons["person-not-after"] ?? [],
});

/**
 * One document naming itself (私たち / 弊社, 私 / 筆者) or its reader (you / one) two ways: the minority form of each slot.
 * Sentences in another language than the document's are left out; quotations are left out by personMentions. A form the
 * language package lists in person-other-sense (本社, also the head office) counts only where it is the usual form.
 */
export const personMix: Detector = (doc, options): Finding[] => {
  const person = wordsOf(doc, options.lexicon ?? []);
  const entries: { readonly sentence: Sentence; readonly mention: PersonMention }[] = doc.sentences
    .filter((sentence) => sentence.embeddedLanguage === undefined)
    .flatMap((sentence) => personMentions(sentence.text, person).map((mention) => ({ sentence, mention })));
  const otherSenses = new Set((doc.lexicons["person-other-sense"] ?? []).map((entry) => entry.pattern));
  return personMinorities(withoutOtherSenses(entries, otherSenses), options.limit).flatMap(({ odd, usual, of }) =>
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
