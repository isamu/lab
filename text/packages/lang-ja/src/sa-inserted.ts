import type { Morpheme } from "./counter-tsu.ts";

/**
 * さ入れ言葉（「読まさせていただく」「行かさせる」）。五段動詞の使役は未然形に「せる」を付けて作る（読ませる・行かせる）。
 * 五段動詞の未然形に「させる」が付けば「さ」が余分に入っている。一段動詞（見させる）とサ変（説明させる）は「させる」が正しく、
 * 解析器は「来させる」を 来さ＋せる と読むので、どれも当たらない。
 */

/** 五段動詞の未然形（読ま・行か）。 */
const isGodanStem = (morpheme: Morpheme | undefined): boolean =>
  morpheme?.pos === "動詞" &&
  morpheme.pos_detail_1 === "自立" &&
  (morpheme.conjugated_type?.startsWith("五段") ?? false) &&
  morpheme.conjugated_form === "未然形";

/** 動詞に付いた「させる」（IPADIC の動詞,接尾）。 */
const isSaseru = (morpheme: Morpheme | undefined): boolean => morpheme?.pos === "動詞" && morpheme.pos_detail_1 === "接尾" && morpheme.basic_form === "させる";

/** sequence[index] が、さ入れ言葉の一部（五段動詞の未然形と、それに付いた「させる」）か。 */
export const isSaInsertedAt = (sequence: readonly Morpheme[], index: number): boolean => {
  const morpheme = sequence[index];
  if (isSaseru(morpheme)) return isGodanStem(sequence[index - 1]);
  return isGodanStem(morpheme) && isSaseru(sequence[index + 1]);
};
