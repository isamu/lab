// Seeded link text that does not say where it goes, for `yarn bench`: a sentence linking from "こちら" or "here".
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

const VAGUE_LINK: Readonly<Record<string, string>> = {
  ja: "手順の詳細は[こちら](https://example.com/guide)です。",
  en: "For the full steps, click [here](https://example.com/guide).",
};

/** 最初の本文の段落の終わりに、行き先を言わないリンクの文を足す。 */
const vagueLinkIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${VAGUE_LINK[language] ?? ""}`,
    );

export const LINK_TEXT_MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `vague-link-${language}`,
  rule: "vague-link-text",
  languages: [language],
  plant: vagueLinkIn(language),
}));
