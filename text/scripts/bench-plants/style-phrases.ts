// Seeded mistakes of phrasing for `yarn bench`: a sentence added to the first prose paragraph that holds a wordy phrase,
// a weasel word, a confused homophone, an opening "So," or など doubled with 等 ("and etc." in English). Pure and deterministic.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

/** Adds the sentence to the end of the first prose line in its language that ends a sentence. */
const appendTo =
  (language: string, added: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${added}`,
    );

const english = (id: string, rule: string, added: string): Mutation => ({ id, rule, languages: ["en"], plant: appendTo("en", added) });

export const MUTATIONS: readonly Mutation[] = [
  english("wordy-in-order-to", "wordy-phrase", "In order to save time, we met online. Due to the fact that the room was booked, we stayed home."),
  {
    id: "wordy-kanou",
    rule: "wordy-phrase",
    languages: ["ja"],
    plant: appendTo("ja", "資料は社内から閲覧することが可能です。現時点において、追加の予定はありません。"),
  },
  english("weasel-experts", "weasel-word", "Many experts say this approach works."),
  { id: "weasel-iwareteiru", rule: "weasel-word", languages: ["ja"], plant: appendTo("ja", "この方式は効果が高いと言われています。") },
  english("homophone-its-own", "homophone-slip", "Each team keeps it's own notes."),
  english("so-opener", "sentence-initial-so", "So, the plan stays as it is."),
  { id: "nado-doubled", rule: "doubled-nado", languages: ["ja"], plant: appendTo("ja", "詳細は資料等などを参照してください。") },
  english("and-etc", "doubled-nado", "Bring pens, paper and etc. to the workshop."),
];
