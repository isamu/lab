// Seeded times the clock does not have, for `yarn bench`: one sentence with a "午後13時" or "13 PM" added to the first
// paragraph. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const IMPOSSIBLE_TIME: Readonly<Record<string, string>> = {
  ja: "説明会は午後13時から始めます。",
  en: "The briefing starts at 13 PM.",
};

/** 最初の本文の段落の終わりに、時計に無い時刻の文を足す。 */
const impossibleTimeIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${IMPOSSIBLE_TIME[language] ?? ""}`,
    );

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `impossible-time-${language}`,
  rule: "impossible-time",
  languages: [language],
  plant: impossibleTimeIn(language),
}));
