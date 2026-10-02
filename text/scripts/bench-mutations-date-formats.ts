// Seeded dates written two ways for `yarn bench`: two dates in one style and a third in another.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

const MIXED_DATES: Readonly<Record<string, string>> = {
  ja: "受付は2026年10月2日から2026年10月9日までで、結果は2026/10/16に送ります。",
  en: "Entries open on October 2, 2026 and close on October 9, 2026; results go out on 10/16/2026.",
};

/** 最初の本文の段落の終わりに、日付を二通りに書いた文を足す。 */
const mixedDatesIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${MIXED_DATES[language] ?? ""}`,
    );

export const DATE_FORMAT_MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `dates-two-ways-${language}`,
  rule: "date-format-consistency",
  languages: [language],
  plant: mixedDatesIn(language),
}));
