import type { Lexicon, Sentence, Token } from "../plugin.ts";

// 行為や条件の中の打ち消し（"goods that do not conform"、「承認しなかった場合」）。打ち消しの語は中身の語ではないが、
// 打ち消しだけが違う二つの文は、違うことを決めている。

/** 打ち消しの語に付ける印（Token.features の名前）。 */
const NEGATION_FEATURE = "negation";

/** 打ち消しを受けた語の印。語の後ろに付ける。 */
export const NEGATED = "¬";

/** 語彙表の打ち消しの語（group の無いもの。接頭の「不」「未」は語の一部なので見ない）。英語は小文字で照らす。 */
export const negationWords = (lexicon: Lexicon | undefined): ReadonlySet<string> =>
  new Set((lexicon ?? []).filter((entry) => entry.group === undefined).map((entry) => entry.pattern.toLowerCase()));

const isNegation = (token: Token, words: ReadonlySet<string>): boolean =>
  words.has(token.surface.toLowerCase()) || (token.lemma !== undefined && words.has(token.lemma.toLowerCase()));

export const isMarkedNegation = (token: Token): boolean => token.features?.[NEGATION_FEATURE] !== undefined;

/** 打ち消しの語に印を付けた文。品詞の無い文はそのまま。 */
export const negationsMarked = (sentences: readonly Sentence[], words: ReadonlySet<string>): Sentence[] =>
  sentences.map((sentence) =>
    sentence.tokens === undefined
      ? sentence
      : {
          ...sentence,
          tokens: sentence.tokens.map((token) => (isNegation(token, words) ? { ...token, features: { ...token.features, [NEGATION_FEATURE]: "yes" } } : token)),
        },
  );

type Placed = { readonly out: readonly string[]; readonly pending: boolean };

/**
 * 語の並びの打ち消しを、すぐ前の語（文頭なら次の語）に NEGATED として付けたもの。どの語にかかるかは読まない。
 * 打ち消しのある文と無い文を分けるための印で、二つ重なっても一つにする。
 */
export const negatedWords = (words: readonly { readonly word: string; readonly negation: boolean }[]): string[] =>
  words
    .reduce<Placed>(
      ({ out, pending }, { word, negation }) => {
        if (!negation) return { out: [...out, pending ? `${word}${NEGATED}` : word], pending: false };
        const last = out.at(-1);
        if (last === undefined) return { out, pending: true };
        return { out: last.endsWith(NEGATED) ? out : [...out.slice(0, -1), `${last}${NEGATED}`], pending: false };
      },
      { out: [], pending: false },
    )
    .out.slice();
