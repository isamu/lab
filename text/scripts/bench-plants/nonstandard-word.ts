// Seeded nonstandard words, for `yarn bench`: one sentence added to the first paragraph in each language.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const NONSTANDARD: Readonly<Record<string, string>> = {
  ja: "結果は前回の数字と違かった。",
  en: "The review team is comprised of three people.",
};

/** 最初の本文の段落の終わりに、標準的でない語を含む文を足す。 */
const nonstandardIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${NONSTANDARD[language] ?? ""}`,
    );

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `nonstandard-word-${language}`,
  rule: "nonstandard-word",
  languages: [language],
  plant: nonstandardIn(language),
}));
