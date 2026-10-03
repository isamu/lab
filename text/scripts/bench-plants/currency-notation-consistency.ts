// Seeded currencies written two ways, for `yarn bench`: three amounts written one way and a fourth another, added to the
// first paragraph. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const MIXED_CURRENCY: Readonly<Record<string, string>> = {
  ja: "費用は 3,000円、500円、800円 で、割引は ¥200 です。",
  en: "The fees are $300, $50 and $20, less a USD 10 discount.",
};

/** 最初の本文の段落の終わりに、同じ通貨を二通りに書いた文を足す。 */
const mixedCurrencyIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${MIXED_CURRENCY[language] ?? ""}`,
    );

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `currency-two-ways-${language}`,
  rule: "currency-notation-consistency",
  languages: [language],
  plant: mixedCurrencyIn(language),
}));
