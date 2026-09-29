/** 対になっていないサロゲートを U+FFFD に置き換える。長さを変えないので、位置はそのまま同じ文字を指す。 */
export const wellFormed = (text: string): string => text.replace(/\p{Surrogate}/gu, "\uFFFD");
