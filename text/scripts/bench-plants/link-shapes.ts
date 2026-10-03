// Seeded link and image shapes for `yarn bench`: a link whose text shows another site, and an image whose alt text is its
// file's name. Pure and deterministic, like scripts/bench-mutations.ts.
import { codeLines, isJapanese, isListItem, isProse, linesOf, replaceLine, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const SENTENCE_END = /[。.]$/u;

const MISMATCHED_LINK: Readonly<Record<string, string>> = {
  ja: "手引きは [https://docs.example.com/guide](https://old.example.net/guide) にあります。",
  en: "The guide is at [https://docs.example.com/guide](https://old.example.net/guide) now.",
};

/** 最初の本文の段落の終わりに、言葉の URL と行き先のサイトが違うリンクの文を足す。 */
const mismatchedLinkIn =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && SENTENCE_END.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${MISMATCHED_LINK[language] ?? ""}`,
    );

/** 最初の段落の後ろに、代替テキストがファイル名のままの図を足す。 */
const fileNameAlt = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const code = codeLines(lines);
  const index = lines.findIndex((line, at) => !code.has(at) && isProse(line) && SENTENCE_END.test(line.trimEnd()) && (lines[at + 1] ?? "").trim() === "");
  const line = lines[index];
  if (line === undefined) return undefined;
  // 段落の行、空行、図の行。
  return { source: replaceLine(lines, index, `${line}\n\n![IMG_2041.png](IMG_2041.png)`), line: index + 3 };
};

export const MUTATIONS: readonly Mutation[] = [
  ...["ja", "en"].map((language) => ({
    id: `link-text-other-host-${language}`,
    rule: "link-text-url-mismatch",
    languages: [language],
    plant: mismatchedLinkIn(language),
  })),
  { id: "image-file-name-alt", rule: "image-file-name-alt", languages: ["ja", "en"], plant: fileNameAlt },
];
