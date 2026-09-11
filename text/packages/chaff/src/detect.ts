import { japaneseRatio, latinRatio } from "./detect-language.ts";

export type LanguageGuess = { readonly language: string; readonly confidence: number; readonly from: string };

/**
 * 技術文書の日本語は英字を大量に含む（コマンド名、識別子、製品名）。
 * 仮名と漢字が 15% あれば日本語と見る。corpus で測るまでの暫定値。spec §26。
 */
const JAPANESE_FLOOR = 0.15;

export const guessLanguage = (source: string): LanguageGuess => {
  const japanese = japaneseRatio(source);
  if (japanese >= JAPANESE_FLOOR) return { language: "ja", confidence: japanese, from: "content" };
  return { language: "en", confidence: latinRatio(source), from: "content" };
};
