import type { Detector, Finding, ProseDocument, Sentence } from "../plugin.ts";
import { personMentions, personMinorities, withoutOtherSenses, type PersonMention, type PersonWords } from "../person-forms.ts";

const wordsOf = (doc: ProseDocument, words: PersonWords["words"]): PersonWords => ({
  words,
  forms: doc.lexicons["person-form"] ?? [],
  notAfter: doc.lexicons["person-not-after"] ?? [],
});

const TOPIC = "は";

/**
 * A self-reference set as a topic against another person's in the same sentence (僕は左を向く、君は右を向いても): the two
 * people of an example, not the writer naming itself. others: the person-contrast word list.
 */
const contrastsPeople = (sentence: Sentence, mention: PersonMention, others: readonly string[]): boolean =>
  sentence.text.startsWith(TOPIC, mention.at + mention.written.length) && others.some((other) => other !== "" && sentence.text.includes(`${other}${TOPIC}`));

/**
 * One document naming itself (私たち / 弊社, 私 / 筆者) or its reader (you / one) two ways: the minority form of each slot.
 * Sentences in another language than the document's are left out; quotations are left out by personMentions, and so is a
 * self-reference contrasted with another person in one sentence (僕は…、君は…). A form the
 * language package lists in person-other-sense (本社, also the head office) counts only where it is the usual form.
 */
export const personMix: Detector = (doc, options): Finding[] => {
  const person = wordsOf(doc, options.lexicon ?? []);
  const others = (doc.lexicons["person-contrast"] ?? []).map((entry) => entry.pattern);
  const entries: { readonly sentence: Sentence; readonly mention: PersonMention }[] = doc.sentences
    .filter((sentence) => sentence.embeddedLanguage === undefined)
    .flatMap((sentence) => personMentions(sentence.text, person).map((mention) => ({ sentence, mention })))
    .filter(({ sentence, mention }) => !contrastsPeople(sentence, mention, others));
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
