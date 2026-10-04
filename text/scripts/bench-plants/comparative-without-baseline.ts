// Seeded comparison with nothing to compare with, for `yarn bench`: one sentence added to the first paragraph in each
// language. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const BARE: Readonly<Record<string, string>> = {
  ja: "新しい仕組みで、作業はさらに簡単になります。",
  en: "With the new setup, the whole process is simpler.",
};

/** 最初の本文の段落の終わりに、比べる相手の無い比較の文を足す。 */
const bareIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${BARE[language] ?? ""}`,
    );

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `comparative-without-baseline-${language}`,
  rule: "comparative-without-baseline",
  languages: [language],
  plant: bareIn(language),
}));
