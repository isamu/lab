// Seeded mixed unit spacing for `yarn bench`: sentences with two spaced quantities and one unspaced, added to the first prose
// paragraph. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const MIXED: Readonly<Record<string, string>> = {
  ja: "容量は 5 GB、転送量は 10 GB、上限は 20GB です。",
  en: "Storage is 5 GB, transfer is 10 GB and the cap is 20GB.",
};

const plantMixed =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${MIXED[language] ?? ""}`,
    );

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `unit-spacing-mixed-${language}`,
  rule: "unit-spacing-consistency",
  languages: [language],
  plant: plantMixed(language),
}));
