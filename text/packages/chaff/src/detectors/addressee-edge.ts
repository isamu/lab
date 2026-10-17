import type { Token } from "../plugin.ts";

/** 連なりの尻の、宛先に付く語。surface はその語、start は文書全体の座標でその語の始まり。 */
export type AddresseeSuffix = { readonly surface: string; readonly start: number };

/**
 * 漢字の連なり run（文書全体の座標で end に終わる）の尻が、宛先の名前に付く語（志木市役所市政情報課宛ての「宛」、御中）なら、
 * その語。その語は名前の後ろに付くもので、名前の一部ではない。語の切れ目で始まるときだけ（宛ての語の頭が「宛」）。
 * 折り返しをまたぐ語（御\n中）は span が surface より長いので、end から字数を引かず、end の直前の字を覆う語の始まりを使う。
 */
export const trailingAddressee = (tokens: readonly Token[], end: number, run: string, suffixes: readonly string[]): AddresseeSuffix | undefined => {
  const suffix = suffixes.find((word) => word !== "" && run.length > word.length && run.endsWith(word));
  if (suffix === undefined) return undefined;
  const token = tokens.find((candidate) => candidate.span.start < end && end <= candidate.span.end);
  return token !== undefined && token.surface.startsWith(suffix) ? { surface: suffix, start: token.span.start } : undefined;
};
