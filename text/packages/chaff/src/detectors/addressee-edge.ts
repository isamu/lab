import type { Token } from "../plugin.ts";

/**
 * 漢字の連なり run（文書全体の座標で end に終わる）の尻が、宛先の名前に付く語（志木市役所市政情報課宛ての「宛」、御中）なら、
 * その語の字数。その語は名前の後ろに付くもので、名前の一部ではない。語の切れ目で始まるときだけ（宛ての語の頭が「宛」）。
 */
export const trailingAddressee = (tokens: readonly Token[], end: number, run: string, suffixes: readonly string[]): number => {
  const suffix = suffixes.find((word) => word !== "" && run.length > word.length && run.endsWith(word));
  if (suffix === undefined) return 0;
  const start = end - suffix.length;
  return tokens.some((token) => token.span.start === start && token.surface.startsWith(suffix)) ? suffix.length : 0;
};
