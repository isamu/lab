import type { Span } from "chaffjs/plugin";
import { escapeRegExp } from "./regexp.ts";

/**
 * 改行を落として一行になった報告書では、項目の番号と見出しが本文の文へ句点なしに続く
 * （「…であります。(3）販売の実績当期の販売実績は…」「５【経営上の重要な契約等】（…）当社は…」）。
 * 分割器は見出しを次の文の頭に読むので、見出しの字が文の長さ・漢字の連続・「の」の数に入り、文末の並びは節をまたぐ。
 *
 * 見出しと本文の境が字で分かる所だけ切る:
 * - 節の番号と墨付き括弧の題（５【…】）と、直後の括弧の副題の後ろ。
 * - 行の途中の項目の番号（①、(3)、幅の違う (3））の後ろで、句点・読点の前に本文を始める語（当社、当期、辞書 run-in-heading-opener）が
 *   出る所か、見出しの頭の語をもう一度書き出す所（④固定資産の減損固定資産の減損は）。
 * 境の分からない見出し（③…の最適化レンタル用資産の…）は切らない。
 */

const LEADING_SPACE = /^[ \t\u3000]*/u;
/** 囲み数字と、括弧の番号、後ろの空白まで。開きと閉じの幅が違っても（(3））一つの印で、括弧はその中で閉じる。 */
const ITEM_MARKER = /^(?:[①-⑳㉑-㉟㊱-㊿⑴-⒇]|[（(][0-9０-９]{1,2}[）)])[ \t\u3000]*/u;
/** 節の番号と墨付き括弧の題。後ろの括弧の副題も題のうち。ただし括弧の番号（(1））は次の項目の印。 */
const NUMBERED_TITLE = /^[0-9０-９]{1,2}【[^【】。\n]{1,60}】(?:[（(](?![0-9０-９a-zA-Zａ-ｚＡ-Ｚ]{1,3}[）)])[^（()）。\n]{2,60}[）)])*/u;
/** 印の後ろが助詞なら、印は文の中の語（①の規定、５【…】に記載）。 */
const PARTICLE_AFTER = /^[ \t\u3000]*(?:の|に|を|が|は|と|で|へ|も|から|まで|より|及び|又は|並びに|若しくは)/u;
/** 見出しは句点・読点・引用符の前で終わる。それより遠くには探さない。 */
const HEADING_STOP = /[。、，,「」『』\n\r]/u;
const HEADING_MAX = 40;
/** 書き出しを繰り返すと読む長さ。短いと見出しの中の同じ字（の状況の）を拾う。 */
const REPEAT_MIN = 4;
const REPEATABLE = /^[\p{L}\p{N}・]+$/u;
/** 見出しは助詞・活用語尾（ひらがな）で終わらない。「売上高は当期…」の「は」の後ろは本文の続き。 */
const ENDS_IN_HIRAGANA = /\p{Script=Hiragana}$/u;

export type HeadingOpeners = RegExp | undefined;

/** 本文を始める語。後ろが助詞か「末」のときだけ（当期純利益の「当期」は語の頭）。 */
export const headingOpeners = (words: readonly string[]): HeadingOpeners => {
  if (words.length === 0) return undefined;
  const alternatives = [...words].toSorted((a, b) => b.length - a.length).map(escapeRegExp);
  return new RegExp(`(?:${alternatives.join("|")})(?=[のにはでもがと及、（(]|末)`, "gu");
};

const headingLength = (rest: string): number => {
  const stop = rest.slice(0, HEADING_MAX).search(HEADING_STOP);
  return stop === -1 ? Math.min(rest.length, HEADING_MAX) : stop;
};

const OPENERS = /[（(［[【〔]/gu;
const CLOSERS = /[）)］\]】〕]/gu;
const closesItsBrackets = (heading: string): boolean => (heading.match(OPENERS)?.length ?? 0) === (heading.match(CLOSERS)?.length ?? 0);

/** 見出しがそこで終わってよいか: 空（印のすぐ後ろが本文）か、ひらがなで終わらず、開いた括弧を閉じている（経営成績（経営成績に関する分析））。 */
const canEndAt = (rest: string, at: number): boolean => {
  const heading = rest.slice(0, at);
  return at === 0 || (!ENDS_IN_HIRAGANA.test(heading) && closesItsBrackets(heading));
};

/**
 * 本文を始める語の位置。印のすぐ後ろの語（(2）当社は…）より、見出しの後ろの語（⑥当社及び当社サービスの認知度向上当社は…）を取る。
 * 本文の中の語（(2）当社は当期に…）は助詞の後ろに立つので、見出しの終わりにならない。
 */
const openerAt = (rest: string, length: number, openers: HeadingOpeners): number | undefined => {
  if (openers === undefined) return undefined;
  const places = [...rest.matchAll(openers)].map((match) => match.index).filter((at) => at < length && canEndAt(rest, at));
  return places.find((at) => at > 0) ?? places[0];
};

/** 見出しの中で次の項目の印が始まる位置（(1)経営成績等の概要①経営成績の状況…）。 */
const INNER_MARKER = /[①-⑳㉑-㉟㊱-㊿⑴-⒇]|[（(][0-9０-９]{1,2}[）)]/gu;
const innerMarkerAt = (rest: string, length: number): number | undefined =>
  [...rest.slice(0, length).matchAll(INNER_MARKER)].map((match) => match.index).find((at) => at > 0 && canEndAt(rest, at));

const repeatAt = (rest: string, length: number): number | undefined => {
  const head = rest.slice(0, REPEAT_MIN);
  if (head.length < REPEAT_MIN || !REPEATABLE.test(head)) return undefined;
  const repeats = [...rest.slice(0, length).matchAll(new RegExp(escapeRegExp(head), "gu"))].map((match) => match.index);
  return repeats.find((at) => at >= REPEAT_MIN && canEndAt(rest, at));
};

/** 印の後ろ（rest）で見出しが終わり本文が始まる位置。分からなければ undefined。 */
const bodyStart = (rest: string, openers: HeadingOpeners): number | undefined => {
  if (PARTICLE_AFTER.test(rest)) return undefined;
  const length = headingLength(rest);
  const found = [openerAt(rest, length, openers), repeatAt(rest, length), innerMarkerAt(rest, length)].filter((at) => at !== undefined);
  return found.length === 0 ? undefined : Math.min(...found);
};

const isLineStart = (source: string, at: number): boolean => at === 0 || /[\n\r]/u.test(source.charAt(at - 1));

/** from から始まる文の頭の見出しの後ろ。題は行の頭でも、項目の番号は行の途中（前の文に続けて書いた所）だけ。 */
const cutAfterHeading = (source: string, from: number, end: number, openers: HeadingOpeners): number | undefined => {
  const lead = from + (LEADING_SPACE.exec(source.slice(from, end))?.[0].length ?? 0);
  const head = source.slice(lead, end);
  const title = NUMBERED_TITLE.exec(head)?.[0];
  if (title !== undefined) return PARTICLE_AFTER.test(head.slice(title.length)) ? undefined : lead + title.length;
  const marker = ITEM_MARKER.exec(head)?.[0];
  if (marker === undefined || isLineStart(source, lead)) return undefined;
  const at = bodyStart(head.slice(marker.length), openers);
  return at === undefined ? undefined : lead + marker.length + at;
};

const cutsFrom = (source: string, from: number, end: number, openers: HeadingOpeners): number[] => {
  const cut = cutAfterHeading(source, from, end, openers);
  if (cut === undefined || cut <= from || source.slice(cut, end).trim() === "") return [];
  return [cut, ...cutsFrom(source, cut, end, openers)];
};

/** span を、頭の見出しと本文に割る。見出しが無ければ span 1 つ。 */
export const cutRunInHeadings = (source: string, span: Span, openers: HeadingOpeners): Span[] => {
  const cuts = cutsFrom(source, span.start, span.end, openers);
  const starts = [span.start, ...cuts];
  return starts.map((start, index) => ({ start, end: cuts[index] ?? span.end }));
};
