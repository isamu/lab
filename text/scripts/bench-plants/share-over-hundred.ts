// Seeded shares above 100%, for `yarn bench`: one sentence with "120% of respondents" added to the first paragraph.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const SHARE_OVER: Readonly<Record<string, string>> = {
  ja: "アンケートでは回答者の120%が賛成でした。",
  en: "In the poll, 120% of respondents agreed.",
};

/** 最初の本文の段落の終わりに、100% を超える一部の割合の文を足す。 */
const shareOverIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${SHARE_OVER[language] ?? ""}`,
    );

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `share-over-hundred-${language}`,
  rule: "share-over-hundred",
  languages: [language],
  plant: shareOverIn(language),
}));
