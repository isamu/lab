// Seeded mistakes of announced lists for `yarn bench`: a list of platforms, then a later sentence naming one more.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

const GROWN: Readonly<Record<string, string>> = {
  ja: "対応OSはWindowsとmacOSです。設定は管理画面から変えられます。Linuxにも対応しています。",
  en: "The client is supported on Windows and macOS. Settings live on the admin page. It is also supported on Linux.",
};

/** 最初の本文の段落の終わりに、一覧と、一覧に無い名前を言う文を足す。 */
const growIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${GROWN[language] ?? ""}`,
    );

export const LIST_MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `list-grown-${language}`,
  rule: "outside-announced-list",
  languages: [language],
  plant: growIn(language),
}));
