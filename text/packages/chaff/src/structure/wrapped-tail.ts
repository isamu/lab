import type { Mention } from "../plugin.ts";

/**
 * 参照を読む行と、その後ろにつないだ次の行。
 *
 * 72 桁で折り返す RFC は「Section 16.3.2\n   of [HTTP]」のように、参照と「どの文書の」を別の行に書く。行だけを読むと
 * 自分の文書の 16.3.2 に見える。改行と字下げは読み手には空白一つなので、そうつないだ文字列を言語の読み手に渡す。
 * 拾った参照は行の中にあるものだけを残す。次の行の参照は、次の行を読むときに拾う。位置は行の上のまま。
 */
export type WrappedLine = { readonly line: string; readonly text: string; readonly lineLength: number };

/** 見出しは次の行へ続かない。見出しの行か、次の行が無い・空なら、行だけ。 */
export const wrappedLine = (text: string, onHeading: boolean, next: string | undefined): WrappedLine => {
  const tail = onHeading ? "" : (next?.trim() ?? "");
  if (tail === "") return { line: text, text, lineLength: text.length };
  const kept = text.trimEnd();
  return { line: text, text: `${kept} ${tail}`, lineLength: kept.length };
};

/** 行の中で終わる参照だけ。つないだ次の行に入り込んだもの（「Sections 1,\n 2」の 2）は捨てる。 */
export const onLine = (mentions: readonly Mention[], wrapped: WrappedLine): readonly Mention[] =>
  mentions.filter((mention) => mention.end <= wrapped.lineLength);
