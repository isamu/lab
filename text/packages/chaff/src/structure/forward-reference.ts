/** 読み手を後ろの本文へ向ける言葉と、それが語のどちら側に立つか（下記、the following は前、below は後ろ）。 */
export type ForwardReference = { readonly pattern: string; readonly position?: "before" | "after" | undefined };

const LATIN_LETTER = /\p{Script=Latin}/u;

/** 言葉の端の字と、その外の字が、英語の一つの語に続いていないか（below は belowground の頭ではない）。 */
const meetsAtWordEdge = (edge: string, outside: string): boolean => !LATIN_LETTER.test(edge) || !LATIN_LETTER.test(outside);

/** 文の中の語に、後ろで定義することを先に断る言葉（下記パブリック・ライセンス、the Licence below）が付いているか。 */
export const pointsAhead = (sentence: string, at: number, term: string, words: readonly ForwardReference[]): boolean => {
  const before = sentence.slice(0, at).trimEnd().toLowerCase();
  const after = sentence
    .slice(at + term.length)
    .trimStart()
    .toLowerCase();
  return words.some(({ pattern, position }) => {
    const word = pattern.toLowerCase();
    if (position === "after") return after.startsWith(word) && meetsAtWordEdge(word.slice(-1), after.charAt(word.length));
    return before.endsWith(word) && meetsAtWordEdge(word.charAt(0), before.charAt(before.length - word.length - 1));
  });
};
