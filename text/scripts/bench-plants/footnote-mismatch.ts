// Seeded note marks with no note, for `yarn bench`: one sentence with a footnote mark "[^9]" that the sample never
// defines, added to the first paragraph. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const DANGLING_NOTE: Readonly<Record<string, string>> = {
  ja: "詳しい条件は別途お知らせします[^9]。",
  en: "The full terms will follow separately[^9].",
};

/** 最初の本文の段落の終わりに、注の無い脚注の印を付けた文を足す。 */
const danglingNoteIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${DANGLING_NOTE[language] ?? ""}`,
    );

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `footnote-missing-${language}`,
  rule: "footnote-mismatch",
  languages: [language],
  plant: danglingNoteIn(language),
}));
