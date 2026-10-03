// Seeded mistakes of sentence shape for `yarn bench`: a Japanese sentence with too many commas, too many 〜的, two
// contrastive が, or a run of sentences opening with a demonstrative, added to the first prose paragraph. Pure.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const appendTo =
  (added: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && isJapanese(line) && line.trimEnd().endsWith("。"),
      (line) => `${line.trimEnd()}${added}`,
    );

const japanese = (id: string, rule: string, added: string): Mutation => ({ id, rule, languages: ["ja"], plant: appendTo(added) });

export const MUTATIONS: readonly Mutation[] = [
  japanese("ten-many", "max-ten", "担当者が、会議室で、新人に、資料を、配布し、内容を、丁寧に、説明しました。"),
  japanese("teki-many", "teki-overuse", "効果的かつ効率的な施策を、積極的に展開します。"),
  japanese("ga-twice", "adversative-ga-repeat", "予算は足りるが、人手が足りないが、納期は守ります。"),
  japanese("demonstrative-run", "demonstrative-opener-run", "これは試みです。その結果は来月出ます。この点は後で報告します。"),
];
