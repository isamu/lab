/**
 * 解析器（kuromoji）が例外を投げる文字を U+FFFD に置き換える。対になっていないサロゲートと NUL（U+0000）。
 * 長さを変えないので、位置はそのまま同じ文字を指す。BMP の全文字を一つずつ渡して、投げたのはこの二つだけだった。
 */
export const wellFormed = (text: string): string => text.replace(/[\p{Surrogate}\0]/gu, "�");
