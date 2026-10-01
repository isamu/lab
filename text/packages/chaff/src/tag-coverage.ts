import type { Sentence } from "./plugin.ts";

/**
 * How many of the sentences came back with tokens. A prepared adapter tags every sentence, so "some" means it could not
 * read part of the document (lang-ja returns no tokens for a paragraph its analyser threw on), and "none" that it tagged nothing.
 */
export type TagCoverage = "all" | "some" | "none";

export const tagCoverage = (sentences: readonly Pick<Sentence, "tokens">[]): TagCoverage => {
  const tagged = sentences.filter((sentence) => sentence.tokens !== undefined).length;
  if (tagged === sentences.length) return "all";
  return tagged === 0 ? "none" : "some";
};
