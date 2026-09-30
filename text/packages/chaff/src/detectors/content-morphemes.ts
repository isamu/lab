// What a sentence adds to a heading, counted in content morphemes: words that stand by themselves and name something.
// Pure; heading-echo measures a language written without spaces with it, where a character count says nothing
// (「会社に勤めています」 carries two new words, 「について説明します」 one, in the same nine characters).
import type { Token } from "../plugin.ts";

/** 代名詞・連体詞・接続詞は、すでに書いたものを指すかつなぐだけで、中身を足さない。 */
const CONTENT_POS = new Set(["NOUN", "PROPN", "NUM", "VERB", "ADJ", "ADV"]);

/** 接頭詞・接尾・非自立の語（Bound）と、動詞にするだけの「する」（VerbType=Light）は、付いた語が中身を持つ。 */
const isContent = (token: Token): boolean => CONTENT_POS.has(token.pos) && token.features?.["Bound"] !== "Yes" && token.features?.["VerbType"] !== "Light";

/** 原形で照らす（変えました → 変える）。原形の無い語は書いた形で。 */
const baseForm = (token: Token): string => (token.lemma ?? token.surface).toLowerCase();

/** The sentence's content morphemes whose base form is not one of the heading's content morphemes, every occurrence counted. */
export const newContentMorphemes = (heading: readonly Token[], sentence: readonly Token[]): number => {
  const said = new Set(heading.filter(isContent).map(baseForm));
  return sentence.filter((token) => isContent(token) && !said.has(baseForm(token))).length;
};
