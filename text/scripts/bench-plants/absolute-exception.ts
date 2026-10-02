// Seeded mistakes for `yarn bench`: a rule stated without exception, and a paragraph later an exception for the same act.
// Pure and deterministic, like scripts/bench-mutations.ts. The sentences are self-written.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

const ABSOLUTE: Readonly<Record<string, string>> = {
  ja: "委託先は、記録を一切外部に共有してはならない。",
  en: "The Vendor must never share the logs with outside parties.",
};

const EXCEPTION: Readonly<Record<string, string>> = {
  ja: "ただし、委託先が監査のために記録を外部に共有する場合を除く。",
  en: "Except for an audit, the Vendor shares the logs with outside parties only on request.",
};

/** The absolute rule's line, counted from the prose line it follows (one blank line between). */
const ABSOLUTE_LINE_OFFSET = 2;

/**
 * 最初の本文の段落の後ろに言い切った決まりを、文書の終わりに例外を置く。言い切った文が植えた行になる。段落の後ろに置くのは、
 * 条の見出しの行と一つの文にならないため。終わりに置くのは、条のある文書でも例外が別の条に入るため（同じ条の例外は、その決まりのただし書）。
 */
const contradictIn =
  (language: string) =>
  (source: string): Plant | undefined => {
    const planted = rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line}\n\n${ABSOLUTE[language] ?? ""}`,
    );
    return planted === undefined
      ? undefined
      : { source: `${planted.source.trimEnd()}\n\n${EXCEPTION[language] ?? ""}\n`, line: planted.line + ABSOLUTE_LINE_OFFSET };
  };

export const ABSOLUTE_MUTATIONS: readonly Mutation[] = ["ja", "en"].map((language) => ({
  id: `absolute-exception-${language}`,
  rule: "absolute-exception",
  languages: [language],
  plant: contradictIn(language),
}));
