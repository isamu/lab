import type { Lexicon } from "chaffjs/plugin";
import type { Morpheme } from "./counter-tsu.ts";

/**
 * ら抜き言葉（「見れる」「食べれる」「来れる」）。一段動詞とカ変動詞の可能は「られる」で作る（食べられる・来られる）。
 * 一段動詞・カ変動詞の未然形に「れる」が直に付けば「ら」が抜けている（食べ＋れる、こ＋れる）。五段動詞の可能動詞（走れる・帰れる）は解析器が一語の一段動詞と読むので当たらない。
 * 解析器が一語として持つら抜きの形（見れる・来れる）は、語彙表 ra-dropped-verb に並べる。
 */
export type RaDroppedVocabulary = ReadonlySet<string>;

export const raDroppedVocabulary = (lexicons: Readonly<Record<string, Lexicon>>): RaDroppedVocabulary =>
  new Set((lexicons["ra-dropped-verb"] ?? []).map((entry) => entry.pattern));

/** 可能を「られる」で作る動詞（一段動詞とカ変動詞）。「れる」はその未然形にしか付かない。 */
const isRareruStem = (morpheme: Morpheme | undefined): boolean =>
  morpheme?.pos === "動詞" && (morpheme.conjugated_type === "一段" || (morpheme.conjugated_type?.startsWith("カ変") ?? false));

/** 動詞に付いた「れる」（IPADIC の動詞,接尾）。 */
const isBareReru = (morpheme: Morpheme | undefined): boolean => morpheme?.pos === "動詞" && morpheme.pos_detail_1 === "接尾" && morpheme.basic_form === "れる";

/** sequence[index] が、ら抜き言葉の一部（一段・カ変動詞の未然形とそれに付いた「れる」、または一語で持つら抜きの形）か。 */
export const isRaDroppedAt = (sequence: readonly Morpheme[], index: number, vocabulary: RaDroppedVocabulary): boolean => {
  const morpheme = sequence[index];
  if (morpheme === undefined) return false;
  if (morpheme.pos === "動詞" && vocabulary.has(morpheme.basic_form)) return true;
  // 「れ」も一段の活用をするので（こ・れ・ない の れ は一段の未然形）、先に「れる」かを見る。
  if (isBareReru(morpheme)) return isRareruStem(sequence[index - 1]);
  return isRareruStem(morpheme) && isBareReru(sequence[index + 1]);
};
