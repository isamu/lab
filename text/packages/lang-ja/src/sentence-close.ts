/**
 * 文が閉じているか。句点の後に閉じ括弧と空白が続いてよい。
 *
 * 「．」は、論文などが「，．」で書くときの句点。仮名・漢字か閉じ括弧の後だけ句点と読む。
 * 数字の後の「．」は番号か小数点なので（１．はじめに、３．５％）、文を閉じない。
 */
const CLOSED = /[。！？!?][")）」』]*\s*$/u;
const FULL_STOP_AFTER_WORD = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー)）」』]．[")）」』]*\s*$/u;

export const closesSentence = (text: string): boolean => CLOSED.test(text) || FULL_STOP_AFTER_WORD.test(text);
