// Seeded look-alike characters for `yarn bench`: a sentence holding a Kangxi radical (ja) or a decomposed accent (en),
// added to the first prose paragraph. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const KANGXI_MOUNTAIN = "⼭";
const COMBINING_ACUTE = "́";

const LOOKALIKE: Readonly<Record<string, string>> = {
  ja: `申込書は総務課の${KANGXI_MOUNTAIN}田さんへ送ってください。`,
  en: `Send the form to the cafe${COMBINING_ACUTE} office.`,
};

const plantLookalike =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${LOOKALIKE[language] ?? ""}`,
    );

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `lookalike-${language}`,
  rule: "lookalike-character",
  languages: [language],
  plant: plantLookalike(language),
}));
