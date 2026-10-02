// Seeded mistakes of definitions for `yarn bench`: a term defined and never used, a term used before its inline
// definition, and an abbreviation spelled out two ways. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

type Sentences = Readonly<Record<string, string>>;

/** 最初の本文の段落の終わりに、文を足す。段落の言語に合う文だけ。 */
const appendTo =
  (language: string, added: Sentences) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${added[language] ?? ""}`,
    );

const UNUSED: Sentences = { ja: "「移行期間」とは、公開から二週間をいう。", en: '"Rollout Window" means the two weeks after a release.' };

const EARLY: Sentences = {
  ja: "売主は、五日以内に発送する。部品は株式会社みなと（以下「売主」という。）が納める。",
  en: 'The Vendor ships within five days. The parts come from Harbour Ltd (the "Vendor").',
};

const TWO_WAYS: Sentences = {
  ja: "SLA（サービス品質保証）を守ります。返金はSLA（サービスレベル契約）に従います。",
  en: "The Service Level Agreement (SLA) applies. Refunds follow the Support Level Agreement (SLA).",
};

const both = (id: string, rule: string, added: Sentences): Mutation[] =>
  ["ja", "en"].map((language) => ({ id: `${id}-${language}`, rule, languages: [language], plant: appendTo(language, added) }));

export const DEFINITION_MUTATIONS: readonly Mutation[] = [
  ...both("definition-unused", "unused-definition", UNUSED),
  ...both("definition-late", "use-before-definition", EARLY),
  ...both("acronym-two-ways", "acronym-expansion-conflict", TWO_WAYS),
];
