// A list of titles written in sentence case (The bridge witch, The story of bubble gum, The law of finance and regulation). Pure.
import type { Token } from "../plugin.ts";

/** Items that open with a capitalised article after a comma or colon: a title's first word, not the writer's sentence. */
const TITLE_ITEMS = 2;

const ITEM_BREAKS: ReadonlySet<string> = new Set([",", ":"]);

const isCapitalised = (token: Token | undefined): boolean => /^\p{Lu}/u.test(token?.surface ?? "");

const opensTitle = (tokens: readonly Token[], at: number): boolean =>
  at > 0 && tokens[at]?.pos === "DET" && isCapitalised(tokens[at]) && ITEM_BREAKS.has(tokens[at - 1]?.surface ?? "");

/**
 * Whether the and / or at `at` is inside one of the titles: the sentence lists titles (two or more items open with a capitalised
 * article mid-sentence) and the word after the and / or is lower case. The joint between two titles is followed by a capital.
 */
export const insideSentenceCaseTitle = (tokens: readonly Token[]): ((at: number) => boolean) => {
  const titles = tokens.filter((__token, at) => opensTitle(tokens, at)).length;
  return (at) => titles >= TITLE_ITEMS && /^\p{Ll}/u.test(tokens[at + 1]?.surface ?? "");
};
