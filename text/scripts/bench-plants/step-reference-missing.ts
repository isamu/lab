// Seeded references to a step that does not exist, for `yarn bench`: a three-step list and a sentence pointing at step 7,
// added at the end of the sample. Pure and deterministic, like scripts/bench-mutations.ts.
import { linesOf, type Mutation, type Plant } from "../bench-text.ts";

const STEPS_AND_REFERENCE: Readonly<Record<string, readonly string[]>> = {
  ja: ["1. アプリを開きます。", "2. 設定を選びます。", "3. 保存します。", "", "うまくいかないときは、手順7からやり直してください。"],
  en: ["1. Open the app.", "2. Choose Settings.", "3. Save.", "", "If it fails, start again from step 7."],
};

/** 文書の終わりに、三つの手順と、手順7を指す文を足す。指摘は最後の文の行。 */
const missingStepIn =
  (language: string) =>
  (source: string): Plant | undefined => {
    const added = STEPS_AND_REFERENCE[language] ?? [];
    const kept = source.trimEnd();
    const planted = [kept, "", ...added, ""].join("\n");
    return { source: planted, line: linesOf(kept).length + added.length + 1 };
  };

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `step-missing-${language}`,
  rule: "step-reference-missing",
  languages: [language],
  plant: missingStepIn(language),
}));
