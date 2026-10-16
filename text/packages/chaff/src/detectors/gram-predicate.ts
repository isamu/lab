import { isNamePart } from "./name-part.ts";
import type { LengthUnit, Span, Token } from "../plugin.ts";

/** 動詞と助動詞。言い回し（ることができます、it is important to）にはこれが入り、主題の名前（state and local tax）には入らない。 */
const PREDICATE_POS = new Set(["VERB", "AUX"]);

const NOUNS = new Set(["NOUN", "PROPN", "ADJ"]);

/** 中身を持たない語。名前の前後に付いても、名前の繰り返しを言い回しに変えない。 */
const FUNCTION_POS = new Set(["ADP", "DET", "CCONJ", "SCONJ", "PART", "PUNCT", "SYM", "X"]);

/**
 * 英語で名詞のすぐ前の動詞は、名詞を飾る語（形容詞を挟んでも同じ）（the upcoming fiscal year、the Disclosing Party、the borrow checker）で、
 * 述語ではない。日本語の名詞の前の動詞（〜にあるコンポーネント）は言い回しの一部になるので、word 単位だけで見る。
 */
const modifiesNoun = (tokens: readonly Token[], index: number, unit: LengthUnit): boolean =>
  unit === "word" && tokens[index]?.pos === "VERB" && NOUNS.has(tokens[index + 1]?.pos ?? "");

/** 英語で大文字の名前の一部になった動詞（Procedures Guide、the Location Object）も、述語ではない。 */
const namePartAt = (tokens: readonly Token[], index: number, unit: LengthUnit): boolean => unit === "word" && isNamePart(tokens, index);

const isName = (tokens: readonly Token[], index: number, unit: LengthUnit): boolean => {
  const token = tokens[index];
  return token !== undefined && (token.pos === "PROPN" || token.features?.["NameType"] !== undefined || namePartAt(tokens, index, unit));
};

const overlaps = (token: Token, window: Span): boolean => token.span.start < window.end && window.start < token.span.end;

const isCut = (token: Token, window: Span): boolean => token.span.start < window.start || window.end < token.span.end;

/**
 * 窓が名前だけを繰り返しているか。predicate（添字）のほかに窓が触れる語が、名前と中身の無い語だけで、名前が 1 つはある。
 * 窓の端で切れた動詞（"ed in the NSF Propos" の identified、"ed by Applicable Law" の prohibited）は語尾しか入っておらず、
 * 動詞は出てくるたびに違ってよい。繰り返されているのは名前のほう。
 */
const onlyNamesBeside = (tokens: readonly Token[], predicate: number, window: Span, unit: LengthUnit): boolean => {
  const touched = tokens.flatMap((token, index) => (index !== predicate && overlaps(token, window) ? [index] : []));
  const names = touched.filter((index) => isName(tokens, index, unit));
  const rest = touched.filter((index) => !isName(tokens, index, unit));
  return names.length > 0 && rest.every((index) => FUNCTION_POS.has(tokens[index]?.pos ?? ""));
};

const COMPOUND_POS = new Set(["NOUN", "PROPN", "ADJ", "NUM"]);
/** 動詞の前の名詞句がこれだけの語を持てば、動詞はその名詞句の最後の名詞。the contract says は 1 語なので述語のまま。 */
const MIN_COMPOUND_WORDS = 2;

/** 語形を変えていない動詞（rate）か -ing 形（subcontracting）。名詞と同じ形で、名詞の読み違いになりうる。described や says は述語の形。 */
const isNounShaped = (token: Token): boolean =>
  token.features?.["VerbForm"] === "Ger" || (token.lemma !== undefined && token.lemma === token.surface.toLowerCase());

/** 動詞の目的語の始まり（models generate the text の the）。後ろにこれが続く動詞は述語。 */
const OBJECT_START = new Set(["DET", "PRON", "NUM"]);

/**
 * 英語で、窓の最後の名詞の形の動詞の前が名詞と形容詞だけ（先頭の冠詞は許す）で、後ろに目的語が続かなければ、動詞は名詞の続きの
 * 読み違い（the federal funds rate の rate、small business subcontracting）。窓の中に機能語があれば言い回し（your contract says）。
 */
const endsNounCompound = (tokens: readonly Token[], index: number, window: Span, unit: LengthUnit): boolean => {
  const verb = tokens[index];
  if (unit !== "word" || verb?.pos !== "VERB" || !isNounShaped(verb) || OBJECT_START.has(tokens[index + 1]?.pos ?? "")) return false;
  const touched = tokens.flatMap((token, at) => (overlaps(token, window) ? [at] : []));
  if (touched.at(-1) !== index) return false;
  const before = touched.slice(0, -1).filter((at, order) => !(order === 0 && tokens[at]?.pos === "DET"));
  return before.length >= MIN_COMPOUND_WORDS && before.every((at) => COMPOUND_POS.has(tokens[at]?.pos ?? ""));
};

const countsAsPredicate = (tokens: readonly Token[], index: number, window: Span, unit: LengthUnit): boolean => {
  const token = tokens[index];
  if (token === undefined || !PREDICATE_POS.has(token.pos) || !overlaps(token, window)) return false;
  if (modifiesNoun(tokens, index, unit) || namePartAt(tokens, index, unit) || endsNounCompound(tokens, index, window, unit)) return false;
  return !isCut(token, window) || !onlyNamesBeside(tokens, index, window, unit);
};

/**
 * 語句が文の中で占める範囲（window、文書の中の位置）に、述語になる動詞か助動詞があるか。
 * 範囲で見る。文字で探すと、同じ文の別の所の動詞「use」が、語句の中の名詞「use」に当たる。
 */
export const hasPredicateIn = (tokens: readonly Token[], window: Span, unit: LengthUnit): boolean =>
  tokens.some((_, index) => countsAsPredicate(tokens, index, window, unit));
