import { morphemes } from "./pos.ts";

const PARTICLE = "助詞";

/**
 * 行頭の番号の後ろが助詞で始まる（「3.11.0 を公開しました。」「4.2 は廃止した。」）なら、番号は文の中の語。
 * 節の題（「4.2 設定」）は名詞で始まる。助詞は前の語が無いと接続詞と読まれる（「が」「で」）ので、番号に続けて読む。
 * 解析器を読み込んでいなければ決めない。
 */
export const startsWithParticle = (number: string, rest: string): boolean =>
  morphemes(`${number}${rest}`)?.find((morph) => morph.start >= number.length)?.pos === PARTICLE;
