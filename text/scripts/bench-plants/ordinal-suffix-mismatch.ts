// Seeded ordinals with the wrong ending, for `yarn bench`: one sentence with a "22th" added to the first paragraph.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const WRONG_ORDINAL: Readonly<Record<string, string>> = {
  ja: "今年で 22th の開催になります。",
  en: "This is our 22th annual edition.",
};

/** 最初の本文の段落の終わりに、字の合わない序数の文を足す。 */
const wrongOrdinalIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${WRONG_ORDINAL[language] ?? ""}`,
    );

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `ordinal-suffix-${language}`,
  rule: "ordinal-suffix-mismatch",
  languages: [language],
  plant: wrongOrdinalIn(language),
}));
