// Seeded mistakes of obligations for `yarn bench`: the same act forbidden in one sentence and allowed in the next.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

const OPPOSITE: Readonly<Record<string, string>> = {
  ja: "委託先は、記録を外部に共有してはならない。委託先は、記録を外部に共有することができる。",
  en: "The Vendor must not share the logs with outside parties. The Vendor may share the logs with outside parties.",
};

/** 最初の本文の段落の終わりに、同じ行為を禁じる文と許す文を足す。 */
const contradictIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${OPPOSITE[language] ?? ""}`,
    );

export const MODAL_MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `modal-opposite-${language}`,
  rule: "modal-conflict",
  languages: [language],
  plant: contradictIn(language),
}));
