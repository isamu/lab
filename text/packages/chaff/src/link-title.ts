import type { Span } from "./plugin.ts";
import { linkTextOf } from "./link-text.ts";

/**
 * 外のページの題名を引いたリンクの文字。行の頭に置いたリンク（- [達成基準 2.4.4: リンクの目的 (コンテキスト内)](https://…)、
 * 参考: [ロードバランサーにタグを付ける](https://…)）は、行き先のページの題名をそのまま写したもので、書き手が言い換えられない。
 * リンクの後ろは行の終わりか、コロンに続く説明（[題名](https://…): 説明）だけを許す。
 * 文の中のリンク（詳しくは[こちら](https://…)をご覧ください）は書き手の言葉で、文書の中や手元のファイルへのリンク（[README](./README.md)）は題名ではない。
 */

const EXTERNAL = /^<?https?:\/\//iu;
const TEXT_END = "](";
/** リンクの前に書いてよいもの: 行頭の空白、箇条書きの印、コロンで終わる短い見出し語（参考:、出典：、See also:）。 */
const LINE_HEAD = /^[ \t]*(?:(?:[-*+]|\d{1,3}[.)])[ \t]+)?(?:[^\n:：。、.,[\]]{1,15}[:：][ \t]*)?$/u;
/** リンクの後ろに書いてよいもの: 行末までの空白と句読点か、説明を始めるコロン。 */
const LINE_TAIL = /^(?:[ \t.,;。、]*(?:\n|$)|[ \t]*[:：])/u;

/** リンクの文字の範囲。[文字](行き先) の形で、行き先が外のページのものだけ。位置は source の上。 */
const externalTextOf = (source: string, link: Span): Span | undefined => {
  const written = source.slice(link.start, link.end);
  const text = linkTextOf(written);
  if (text === undefined) return undefined;
  const destination = written.slice(1 + text.length + TEXT_END.length);
  return EXTERNAL.test(destination) ? { start: link.start + 1, end: link.start + 1 + text.length } : undefined;
};

const headsItsLine = (source: string, link: Span): boolean => {
  const lineStart = source.lastIndexOf("\n", link.start - 1) + 1;
  return LINE_HEAD.test(source.slice(lineStart, link.start)) && LINE_TAIL.test(source.slice(link.end));
};

/** 外のページの題名を引いたリンクの、文字の範囲（角括弧は含まない）。位置は source の上。links は doc.links。 */
export const externalLinkTitleSpans = (source: string, links: readonly Span[]): Span[] =>
  links.flatMap((link) => {
    const text = externalTextOf(source, link);
    return text !== undefined && headsItsLine(source, link) ? [text] : [];
  });
