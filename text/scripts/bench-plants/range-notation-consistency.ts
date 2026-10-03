// Seeded ranges written with two marks, for `yarn bench`: three ranges with one mark and a fourth with another, added
// to the first paragraph. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const MIXED_RANGES: Readonly<Record<string, string>> = {
  ja: "定員は 10〜20 名、所要は 30〜40 分、費用は 500〜800 円で、対象は 6-12 歳です。",
  en: "Groups of 10–20 meet for 30–40 minutes at 5–8 dollars, for children aged 6-12 years.",
};

/** 最初の本文の段落の終わりに、範囲を二通りの記号で書いた文を足す。 */
const mixedRangesIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${MIXED_RANGES[language] ?? ""}`,
    );

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `ranges-two-ways-${language}`,
  rule: "range-notation-consistency",
  languages: [language],
  plant: mixedRangesIn(language),
}));
