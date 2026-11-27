import type { Section, Span, Token } from "../plugin.ts";

/** 中身を持つ語の品詞。名詞にするだけの「する」（VerbType=Light）は除く。 */
const CONTENT_POS = new Set(["NOUN", "PROPN", "VERB", "ADJ"]);

const isContent = (token: Token): boolean => CONTENT_POS.has(token.pos) && token.features?.["VerbType"] !== "Light";

const lemmaOf = (token: Token): string => (token.lemma ?? token.surface).toLowerCase();

/** 文書の題（一番上の見出し）の、中身を持つ語の原形。品詞が無ければ空。 */
export const subjectLemmas = (sections: readonly Pick<Section, "depth" | "headingTokens">[]): ReadonlySet<string> =>
  new Set(
    sections
      .filter((section) => section.depth === 1)
      .flatMap((section) => section.headingTokens ?? [])
      .filter(isContent)
      .map(lemmaOf),
  );

/**
 * 窓の中の中身を持つ語がどれも題の語か（you can record the の record、題は Record keeping）。主題を言う語のほかは機能語だけの語句は、
 * 文書が主題を扱うたびに出る言い方で、書き手の言い直しではない。中身を持つ語が無いか、題に無い語が一つでもあれば違う。
 */
export const onlySubjectIn = (tokens: readonly Token[], window: Span, subject: ReadonlySet<string>): boolean => {
  const content = tokens.filter((token) => token.span.start < window.end && token.span.end > window.start && isContent(token));
  return content.length > 0 && content.every((token) => subject.has(lemmaOf(token)));
};
