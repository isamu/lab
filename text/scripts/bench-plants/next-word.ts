// Seeded mistakes for `yarn bench`: an article against the next word's sound, and "very" + adjective piled into one
// paragraph, added to the first English prose paragraph (とても + adjective in the first Japanese one). Pure and deterministic.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant, type PlantContext } from "../bench-text.ts";
import { isCounted } from "../bench-mutations-phrasing.ts";

const appendTo =
  (added: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && !isJapanese(line) && /\.$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()} ${added}`,
    );

const appendToJapanese =
  (added: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && isJapanese(line) && /。$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${added}`,
    );

const VERY_PILE = "It was very important, very urgent and very hard, and the plan was very good and very clear.";

const VERY_PILE_JA = "画面はとても便利で、すごく速い。設定は非常に簡単で、とても静かだ。案内もすごく丁寧で、とても分かりやすい。";

/** very-adjective measures density, so a sample too short to be measured gets no plant. */
const pileVery =
  (append: (source: string) => Plant | undefined) =>
  (source: string, context: PlantContext): Plant | undefined => {
    const planted = append(source);
    return planted !== undefined && isCounted(planted.source, context) ? planted : undefined;
  };

export const MUTATIONS: readonly Mutation[] = [
  { id: "article-a-hour", rule: "article-sound", languages: ["en"], plant: appendTo("We waited a hour for the reply.") },
  { id: "very-pile", rule: "very-adjective", languages: ["en"], plant: pileVery(appendTo(VERY_PILE)) },
  { id: "totemo-pile", rule: "very-adjective", languages: ["ja"], plant: pileVery(appendToJapanese(VERY_PILE_JA)) },
];
