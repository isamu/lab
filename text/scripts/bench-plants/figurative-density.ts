// Seeded pile of decorative figures, for `yarn bench`: sentences full of figures added to the first paragraph in each
// language. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const FIGURES: Readonly<Record<string, string>> = {
  ja: "まるで魔法のように作業が片付きます。最初の手順は呪文のようなものなので、おまじないとして覚えておきます。結果は夢のようでした。",
  en: "The tool works like magic. Its secret sauce is an incantation that magically sorts every file, and it runs like clockwork.",
};

/** 最初の本文の段落の終わりに、たとえを重ねた文を足す。 */
const figuresIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${FIGURES[language] ?? ""}`,
    );

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `figurative-density-${language}`,
  rule: "figurative-density",
  languages: [language],
  plant: figuresIn(language),
}));
