import type { Sentence } from "./plugin.ts";

/**
 * 文の長さ。**覆った部分の空白を数えない。**
 *
 * 非 prose は同じ長さの空白で覆っている（オフセットを保つため）。そのまま数えると、
 * URL を 1 つ含む文が「245 文字」になる。実文書で max-sentence-length が指摘の
 * 8 割を占めていた原因はこれで、読み手が長いと感じる長さではなかった。
 *
 * 日本語は文字数、英語は語数。単位は adapter が宣言する。
 */
export const proseText = (sentence: Sentence): string => sentence.text.replace(/\s+/gu, " ").trim();

export const charLength = (sentence: Sentence): number => sentence.text.replace(/\s+/gu, "").length;

const wordLength = (sentence: Sentence): number =>
  proseText(sentence)
    .split(" ")
    .filter((word) => word.length > 0).length;

export const lengthOf = (sentence: Sentence, unit: "char" | "word"): number => (unit === "char" ? charLength(sentence) : wordLength(sentence));
