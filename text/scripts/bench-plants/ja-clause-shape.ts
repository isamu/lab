// Seeded mistakes of clause shape for `yarn bench`: three sentences ending the same way, a 〜たり with no partner,
// 全然 with no negation, より for a starting point and a sentence opening with なので, added to the first prose
// paragraph of a Japanese sample. Pure.
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
  japanese("ending-run", "repeated-sentence-ending", "手順は明確です。費用も妥当です。期間も十分です。"),
  japanese("tari-alone", "tari-unpaired", "休日は本を読んだり、映画を見ます。"),
  japanese("zenzen-positive", "adverb-without-negation", "納期は全然大丈夫です。"),
  japanese("yori-origin", "yori-as-from", "新しい窓口は4月1日より受付を開始します。"),
  japanese("nanode-opener", "colloquial-opener", "なので、出荷は来週になります。"),
];
