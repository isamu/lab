// Seeded clock-time mistakes, for `yarn bench`: a short day's schedule with one time out of order added after the first
// paragraph (time-order), and a sentence with a leg that arrives before it departs (arrival-before-departure). Pure and
// deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const SCHEDULE: Readonly<Record<string, readonly string[]>> = {
  ja: ["- 09:00 集合", "- 12:00 昼食", "- 11:00 報告会", "- 18:00 解散"],
  en: ["- 9:00 AM Meet", "- 12:00 PM Lunch", "- 11:00 AM Report meeting", "- 6:00 PM Close"],
};
/** The schedule's item out of order, counted from the paragraph's line (a blank line, then the items). */
const OUT_OF_ORDER_LINE = 4;

const LEG: Readonly<Record<string, string>> = {
  ja: "帰りの便は福岡 11:30発、羽田 11:05着です。",
  en: "The return flight departs Fukuoka at 11:30 and arrives in Tokyo at 11:05.",
};

const isParagraphIn = (language: string) => (line: string) =>
  isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd());

/** 最初の本文の段落のあとに、一つだけ時刻の戻る一日の予定を足す。 */
const scheduleIn =
  (language: string) =>
  (source: string): Plant | undefined => {
    const plant = rewriteFirst(source, isParagraphIn(language), (line) => [line, "", ...(SCHEDULE[language] ?? [])].join("\n"));
    return plant === undefined ? undefined : { ...plant, line: plant.line + OUT_OF_ORDER_LINE };
  };

/** 最初の本文の段落の終わりに、着が発より前の便の文を足す。 */
const legIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(source, isParagraphIn(language), (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${LEG[language] ?? ""}`);

export const MUTATIONS: readonly Mutation[] = ["ja", "en"].flatMap((language) => [
  { id: `time-order-${language}`, rule: "time-order", languages: [language], plant: scheduleIn(language) },
  { id: `arrival-before-departure-${language}`, rule: "arrival-before-departure", languages: [language], plant: legIn(language) },
]);
