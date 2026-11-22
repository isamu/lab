import type { Span } from "./plugin.ts";

/**
 * 紹介記事の一覧で、リンクを外して写した行の頭の題名（〜の取り組みについて（デジタル庁公式note） 〜を紹介しています。）。
 * 題名は行の頭から、載せた媒体の名前を入れた全角の丸括弧まで。その後ろに半角の空白を一つ置いて、紹介の文が続く。
 * 題名は行き先のページのもので、書き手は言い換えられない。括弧の中に「の」のほかのひらがなのある説明（写しが原本と同じことの認証）、後ろが助詞で続く文の中の
 * 名前（〜（IPA） をご覧ください）、後ろが空白や記号の表（（自己株式等） －－－）は題名と見ない。
 */
const RUN_IN_TITLE =
  /^([ \t]*(?:(?:[-*+]|\d{1,3}[.)])[ \t]+)?)([^\n。|]+?（(?:[^）\n\p{Script=Hiragana}]|の){1,30}）)(?= (?:「|[^\s\p{P}\p{S}をがにへでとはもの]))/gmu;

/** 行の頭の、媒体の名前を括弧に入れた題名の範囲（行頭の箇条書きの印は含まない）。位置は source の上。 */
export const runInTitleSpans = (source: string): Span[] =>
  [...source.matchAll(RUN_IN_TITLE)].map((match) => {
    const start = match.index + (match[1] ?? "").length;
    return { start, end: start + (match[2] ?? "").length };
  });
