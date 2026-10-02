// Seeded redundant pairs for `yarn bench`: a sentence that says one thing twice (一番最初, end result).
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

const REDUNDANT: Readonly<Record<string, string>> = {
  ja: "一番最初に結論を書きます。",
  en: "The end result is the same.",
};

/** 最初の本文の段落の終わりに、重言を含む文を足す。 */
const redundantIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${REDUNDANT[language] ?? ""}`,
    );

export const REDUNDANCY_MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `redundant-${language}`,
  rule: "redundant-expression",
  languages: [language],
  plant: redundantIn(language),
}));
