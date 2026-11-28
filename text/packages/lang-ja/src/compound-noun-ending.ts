import type { Morpheme } from "./counter-tsu.ts";

/**
 * 名詞に動詞の連用形を付けて作った名詞（豆挽き、窓拭き）。IPADIC は辞書に無い組み合わせを「豆 + 挽き（動詞,連用形）」と読むので、
 * 文末に置くと動詞で終わる文に見え、体言止めが数えられず、である調の文と読まれる。
 * 連用形の動詞が助詞を挟まずに名詞の直後に付き、すぐ句点で閉じるときだけ名詞に直す。続く文（書類を出し、）は句点の前ではないのでそのまま。
 * 「在庫あり。」の「ある」と、サ変名詞に付く「する」は名詞を作らないので直さない。「毎朝走り。」の毎朝のような副詞にもなる名詞と、
 * 単独では何も指さない名詞（こと・もの）の後ろも直さない。
 */
const CLAUSE_VERBS = new Set(["ある", "する"]);

const STOPS = new Set(["。", "．"]);

const isNounHead = (morpheme: Morpheme | undefined): boolean =>
  morpheme?.pos === "名詞" && !["非自立", "副詞可能"].includes(morpheme.pos_detail_1) && morpheme.pos_detail_2 !== "副詞可能";

const isContinuativeVerb = (morpheme: Morpheme): boolean =>
  morpheme.pos === "動詞" && morpheme.pos_detail_1 === "自立" && morpheme.conjugated_form === "連用形" && !CLAUSE_VERBS.has(morpheme.basic_form);

const closesAfter = (morpheme: Morpheme | undefined): boolean => morpheme !== undefined && STOPS.has(morpheme.surface_form);

const asNoun = (morpheme: Morpheme): Morpheme => ({
  surface_form: morpheme.surface_form,
  pos: "名詞",
  pos_detail_1: "一般",
  pos_detail_2: "*",
  basic_form: morpheme.surface_form,
  ...(morpheme.reading === undefined ? {} : { reading: morpheme.reading }),
});

/** 形態素の並びを受け取り、名詞の直後で句点の直前にある連用形の動詞を名詞にした並びを返す。ほかの語はそのまま。 */
export const readCompoundNounEnding = (morphemes: readonly Morpheme[]): Morpheme[] =>
  morphemes.map((morpheme, index) =>
    isContinuativeVerb(morpheme) && isNounHead(morphemes[index - 1]) && closesAfter(morphemes[index + 1]) ? asNoun(morpheme) : morpheme,
  );
