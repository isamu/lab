import type { Span, Token } from "../plugin.ts";
import { isWithinAny } from "../quoted-span.ts";

/**
 * 段階の一つとしての比較（より良い（BESTな）改善 と 良い（BETTERな）改善、より良い実装例1 と 良い実装例2）。文書が同じ語を
 * 比べる副詞なしでも書いていれば（良い改善）、「より良い」の相手はその一段下の段で、相手は書いてある。
 * 段は、程度を言う語の原形と、その後ろの名詞で見分ける。間の括弧の添え書き（（BESTな））は飛ばす。
 */

/** 程度を言う語が語の位置 at で始まるか。bare-comparative.ts の判定を受け取る。 */
export type IsGradable = (tokens: readonly Token[], at: number) => boolean;

/** 形容動詞の語幹の後ろに来る語（豊かな）。この語の後ろから名詞を探す。 */
const ADJECTIVAL_TAIL = new Set(["な", "に", "だ", "です", "で"]);
const OPENING = new Set(["（", "("]);
const CLOSING = new Set(["）", ")"]);

/** 程度を言う語（at）の後ろの最初の語の位置。形容動詞の語尾と、括弧の添え書きを飛ばす。 */
const afterWord = (tokens: readonly Token[], at: number): number => {
  const next = tokens[at]?.pos === "NOUN" && ADJECTIVAL_TAIL.has(tokens[at + 1]?.surface ?? "") ? at + 2 : at + 1;
  if (!OPENING.has(tokens[next]?.surface ?? "")) return next;
  const close = tokens.findIndex((token, index) => index > next && CLOSING.has(token.surface));
  return close === -1 ? next : close + 1;
};

/** 段の名前: 程度を言う語の原形と、後ろの名詞。後ろが名詞でなければ段ではない。 */
export const stepKeyAt = (tokens: readonly Token[], at: number): string | undefined => {
  const [word, noun] = [tokens[at], tokens[afterWord(tokens, at)]];
  if (word === undefined || noun === undefined || noun.pos !== "NOUN") return undefined;
  return `${word.lemma ?? word.surface}|${noun.surface}`;
};

/** 文の語と、引いたもの（鉤括弧の中）の範囲。引いた語（「良い対応」という表現）は文書が書いた段ではない。 */
export type StepSentence = { readonly tokens: readonly Token[]; readonly quoted: readonly Span[] };

/** 文書が比べる副詞（markers）なしで書いた、程度を言う語と名詞の段の名前。 */
export const plainStepKeys = (sentences: readonly StepSentence[], markers: ReadonlySet<string>, isGradable: IsGradable): ReadonlySet<string> =>
  new Set(
    sentences.flatMap(({ tokens, quoted }) =>
      tokens.flatMap((token, at) => {
        if (markers.has(tokens[at - 1]?.surface ?? "") || isWithinAny(quoted, token.span) || !isGradable(tokens, at)) return [];
        const key = stepKeyAt(tokens, at);
        return key === undefined ? [] : [key];
      }),
    ),
  );

/** 比べた語（word）が、文書が一段下を書いた段の一つか。 */
export const isNamedStep = (tokens: readonly Token[], word: Token, steps: ReadonlySet<string>): boolean => {
  const key = stepKeyAt(tokens, tokens.indexOf(word));
  return key !== undefined && steps.has(key);
};
