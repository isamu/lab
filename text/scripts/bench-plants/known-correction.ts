// Seeded slips a correction lexicon knows for `yarn bench`: a misspelt word, and a homophone the input method picked.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

/** 最初の本文の段落の終わりに、文を一つ足す。 */
const appendTo =
  (language: string, sentence: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${sentence}`,
    );

export const MUTATIONS: readonly Mutation[] = [
  { id: "misspelt-ja", rule: "known-misspelling", languages: ["ja"], plant: appendTo("ja", "詳しくはシュミレーションの結果を見てください。") },
  { id: "misspelt-en", rule: "known-misspelling", languages: ["en"], plant: appendTo("en", "The details are in a seperate note.") },
  { id: "misconverted-ja", rule: "misconversion", languages: ["ja"], plant: appendTo("ja", "設定は以外と簡単です。") },
];
