// Seeded mistakes for `yarn bench`: a quotation given to someone, in a paragraph of its own with no source.
// Pure and deterministic, like scripts/bench-mutations.ts. The sentences are self-written.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const QUOTED: Readonly<Record<string, string>> = {
  ja: "ある設計者は「遅れている計画に人を足すと、計画はさらに遅れる」と述べている。",
  en: 'As one designer put it, "adding people to a late plan only makes the plan later."',
};

/** The quotation's line, counted from the prose line it follows (one blank line between). */
const QUOTED_LINE_OFFSET = 2;

/** 最初の本文の段落の後ろに、出典の無い引用だけの段落を置く。その段落が植えた行になる。 */
const quoteIn =
  (language: string) =>
  (source: string): Plant | undefined => {
    const planted = rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line}\n\n${QUOTED[language] ?? ""}`,
    );
    return planted === undefined ? undefined : { source: planted.source, line: planted.line + QUOTED_LINE_OFFSET };
  };

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `quote-without-source-${language}`,
  rule: "quote-without-source",
  languages: [language],
  plant: quoteIn(language),
}));
