import type { Mention } from "../plugin.ts";

/**
 * 参照を読む行と、その前後につないだ行。
 *
 * 72 桁で折り返す RFC は「Section 16.3.2\n   of [HTTP]」「RFC 7657\n   (Sections 5.1 …)」のように、参照と「どの文書の」を別の行に書く。
 * 行だけを読むと自分の文書の 16.3.2 に見える。改行と字下げは読み手には空白一つなので、そうつないだ文字列を言語の読み手に渡す。
 * 拾った参照は行の中にあるものだけを残す。前後の行の参照は、その行を読むときに拾う。位置は行の上のまま。
 * leadLength は text の先頭につないだ前の行の長さ（つなぎの空白を含む）。前の行をつながなければ無い。
 */
export type WrappedLine = { readonly line: string; readonly text: string; readonly lineLength: number; readonly leadLength?: number };

/**
 * 前の行は末尾のこれだけを読む。文書の名前（「35 CFR」「RFC 7657」）は数語なので足りる。長く読むと前の行の参照
 * （「Article 58 of the UK GDPR (powers),」）まで入り、その文書が次の行の括弧の中の参照に移る。
 */
export const LEAD_REACH = 24;

/** 前の行の末尾。長ければ LEAD_REACH の内側の最初の空白から後ろにして、語の途中から始めない。空白が無ければ読まない。 */
const leadOf = (previous: string | undefined): string => {
  const trimmed = previous?.trim() ?? "";
  if (trimmed.length <= LEAD_REACH) return trimmed;
  const end = trimmed.slice(-LEAD_REACH);
  const space = end.search(/\s/u);
  return space === -1 ? "" : end.slice(space).trimStart();
};

/** 見出しは前後の行へ続かない。見出しの行か、前後の行が無い・空なら、その側はつながない。 */
export const wrappedLine = (text: string, onHeading: boolean, next: string | undefined, previous?: string): WrappedLine => {
  const tail = onHeading ? "" : (next?.trim() ?? "");
  const lead = onHeading ? "" : leadOf(previous);
  const kept = tail === "" ? text : text.trimEnd();
  const joined = tail === "" ? text : `${kept} ${tail}`;
  if (lead === "") return { line: text, text: joined, lineLength: kept.length };
  // 全角どうしでも空白でつなぐ。詰めると、前の行の宛名（「…担当課」）が次の行の法令名（「構造改革特別区域法」）に付く。
  const joint = `${lead} `;
  return { line: text, text: `${joint}${joined}`, lineLength: kept.length, leadLength: joint.length };
};

/** 行の中で始まり、行の中で終わる参照だけを、行の上の位置で。つないだ前後の行に入り込んだもの（「Sections 1,\n 2」の 2）は捨てる。 */
export const onLine = (mentions: readonly Mention[], wrapped: WrappedLine): readonly Mention[] => {
  const lead = wrapped.leadLength ?? 0;
  if (lead === 0) return mentions.filter((mention) => mention.end <= wrapped.lineLength);
  return mentions
    .filter((mention) => mention.start >= lead && mention.end <= lead + wrapped.lineLength)
    .map((mention) => ({ ...mention, start: mention.start - lead, end: mention.end - lead }));
};
