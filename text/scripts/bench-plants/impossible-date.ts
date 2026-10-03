// Seeded dates the calendar does not have, for `yarn bench`: one sentence with an April 31 added to the first paragraph.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const IMPOSSIBLE_DATE: Readonly<Record<string, string>> = {
  ja: "次の締切は4月31日です。",
  en: "The next deadline is April 31.",
};

/** 最初の本文の段落の終わりに、暦に無い日付の文を足す。 */
const impossibleDateIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${IMPOSSIBLE_DATE[language] ?? ""}`,
    );

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `impossible-date-${language}`,
  rule: "impossible-date",
  languages: [language],
  plant: impossibleDateIn(language),
}));
