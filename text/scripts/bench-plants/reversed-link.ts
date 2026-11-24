// A seeded link written the wrong way round, for `yarn bench`: a sentence with "(text)[URL]" after the first prose paragraph.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const REVERSED_LINK: Readonly<Record<string, string>> = {
  ja: "手順は(作業の手引き)[https://example.com/guide]にあります。",
  en: "The steps are in the (work guide)[https://example.com/guide].",
};

const reversedLinkIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${REVERSED_LINK[language] ?? ""}`,
    );

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `reversed-link-${language}`,
  rule: "reversed-link",
  languages: [language],
  plant: reversedLinkIn(language),
}));
