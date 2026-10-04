// Seeded mixed ellipses for `yarn bench`: sentences with two ellipses one way and a third the other way, added to the first
// prose paragraph. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const MIXED: Readonly<Record<string, string>> = {
  ja: "準備中です……。確認中です……。少々お待ちください・・・。",
  en: "Loading… Saving… Please wait...",
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
  id: `ellipsis-mixed-${language}`,
  rule: "ellipsis-consistency",
  languages: [language],
  plant: plantMixed(language),
}));
