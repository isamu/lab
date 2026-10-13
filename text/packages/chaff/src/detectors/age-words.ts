import type { ProseDocument } from "../plugin.ts";
import type { AgeWord, AgeWords } from "../facts/age-values.ts";

const ageWordsAt = (doc: ProseDocument, id: string): AgeWord[] =>
  (doc.lexicons[id] ?? []).map((entry): AgeWord => ({ pattern: entry.pattern, position: entry.position ?? "before" }));

/** 年齢の語: 印（fact-age-mark）、上限の印（fact-age-limit）、範囲をつなぐ語（fact-age-joiner）。 */
export const ageWordsOf = (doc: ProseDocument): AgeWords => ({
  marks: ageWordsAt(doc, "fact-age-mark"),
  limits: ageWordsAt(doc, "fact-age-limit"),
  joiners: (doc.lexicons["fact-age-joiner"] ?? []).map((entry) => entry.pattern),
});
