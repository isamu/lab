// Seeded mistakes of names for `yarn bench`: a name written twice one way and once another way.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

const SLIPPED: Readonly<Record<string, string>> = {
  ja: "担当は山田太郎です。見積もりは山田太郎が作り、請求書は山田太朗が送ります。",
  en: "The code lives on Codeberg. Reviews happen on Codeberg, and releases are tagged on CodeBerg.",
};

/** 最初の本文の段落の終わりに、同じ名前を二通りに書いた文を足す。 */
const slipIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${SLIPPED[language] ?? ""}`,
    );

export const NAME_MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `name-slipped-${language}`,
  rule: "name-variant",
  languages: [language],
  plant: slipIn(language),
}));
