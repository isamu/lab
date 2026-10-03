// Seeded label-and-number headings, for `yarn bench`: two sections headed only "メリット1" / "Benefit 1" and the next
// number, added at the end of the sample. Pure and deterministic, like scripts/bench-mutations.ts.
import type { Mutation, Plant } from "../bench-text.ts";

const SECTIONS: Readonly<Record<string, readonly string[]>> = {
  ja: ["## メリット1", "", "空き状況がすぐ分かります。", "", "## メリット2", "", "取り消しが一度で済みます。"],
  en: ["## Benefit 1", "", "You can see free rooms at once.", "", "## Benefit 2", "", "You can cancel in one step."],
};

/** 文書の終わりに、札と番号だけの見出しの節を二つ足す。指摘の行は一つ目の見出し。 */
const bareHeadingsIn =
  (language: string) =>
  (source: string): Plant | undefined => {
    const lines = source.trimEnd().split("\n");
    const added = SECTIONS[language] ?? [];
    return { source: `${[...lines, "", ...added].join("\n")}\n`, line: lines.length + 2 };
  };

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `numbered-generic-heading-${language}`,
  rule: "numbered-generic-heading",
  languages: [language],
  plant: bareHeadingsIn(language),
}));
