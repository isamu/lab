/**
 * 解析器（wink）は ' しかアポストロフィと読まず、that’s を that / ’ / s に割る。’ を ' に置き換えてから渡す。
 * ’ は閉じの一重引用符でもあるので、字と字に挟まれたとき（don’t, team’s, 1990’s）だけ置き換える。閉じの引用符の後ろに字は続かない。
 * ʼ（U+02BC）は引用符には使わないので、いつも置き換える。一字を一字に置き換えるので、位置は本文のまま。
 */
const APOSTROPHE = /(?<=[\p{L}\p{N}])’(?=\p{L})|ʼ/gu;

export const straightApostrophes = (text: string): string => text.replace(APOSTROPHE, "'");
