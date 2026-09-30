import type { Span } from "./plugin.ts";

/**
 * 1 行に 1 段落を書き、段落の間に空行を置かない文書（青空文庫、議事録、`<br>` で改行した HTML）。
 * Markdown では全体が 1 つの段落になるが、書いた人にとっては行が段落。
 *
 * 割るのは文の終わる改行だけ。文の境目は解析器が改行をつないだ上で決めたもの（#248）なので、折り返した文は割れない。
 * 形で見分けるのは 2 つ:
 * - 固定幅の折り返しは、行の多くが文の途中で終わる。文で終わる行（段落の最後の行を含む）が半分に届かなければ割らない
 *   （議事録は発言者の行と発言の行が交互に来るので、半分ちょうどは割る）。
 * - 1 行 1 文の書き方（行を意味の切れ目で改める。英語の Markdown に多い）は、段落のつもりではない。
 *   文の頭で始まり文の終わりで終わる行が 2 文以上を持つことが、段落を 1 行に書いた印。それがたまにしか無ければ割らない。
 */

/** 2 文以上を持つ行がこれより少なければ、1 行 1 文の書き方にたまに混じる 2 文の行と見分けられない。 */
const MIN_MULTI_SENTENCE = 3;
/** 2 文以上を持つ行が、割った段落の数のこの割合に届かなければ割らない。議事録は 1 文の発言が多い。 */
const MULTI_SENTENCE_SHARE = 1 / 5;

const NEWLINE = /\r?\n/gu;

type Line = { readonly span: Span; readonly newline: number };

/** 段落の中の行と、その行を終える改行の位置（最後の行は段落の終わり）。 */
const linesOf = (source: string, paragraph: Span): Line[] => {
  const text = source.slice(paragraph.start, paragraph.end);
  const breaks = [...text.matchAll(NEWLINE)].map((match) => ({ at: paragraph.start + match.index, width: match[0].length }));
  const starts = [paragraph.start, ...breaks.map((found) => found.at + found.width)];
  return starts.map((start, index) => {
    const end = breaks[index]?.at ?? paragraph.end;
    return { span: { start, end }, newline: end };
  });
};

/** 文の前後の空白を除いた範囲。改行が文の中にあるかを、空白でなく文字で決める。 */
const coreOf = (source: string, sentence: Span): Span => {
  const text = source.slice(sentence.start, sentence.end);
  return { start: sentence.start + text.length - text.trimStart().length, end: sentence.end - (text.length - text.trimEnd().length) };
};

/** cores（並び順、重ならない）の中で、start が offset 以上の最初の添字。何万行の段落でも行ごとに全部をなめない。 */
const firstStartingAt = (cores: readonly Span[], offset: number): number => {
  const search = (low: number, high: number): number => {
    if (low >= high) return low;
    const middle = (low + high) >> 1;
    return (cores[middle]?.start ?? Number.POSITIVE_INFINITY) >= offset ? search(low, middle) : search(middle + 1, high);
  };
  return search(0, cores.length);
};

/** 改行をまたぐ文が無い。またぐなら、改行の直前に始まった文がまだ続いている。 */
const endsSentence = (line: Line, cores: readonly Span[]): boolean => (cores[firstStartingAt(cores, line.newline) - 1]?.end ?? 0) <= line.newline;

/** 行の並びを、文の終わる改行で区切った段落。 */
const groupAt = (lines: readonly Line[], closing: readonly boolean[]): Span[] => {
  const firsts = lines.flatMap((_, index) => (index === 0 || closing[index - 1] === true ? [index] : []));
  return firsts.map((first, index) => ({
    start: lines[first]?.span.start ?? 0,
    end: lines[(firsts[index + 1] ?? lines.length) - 1]?.span.end ?? 0,
  }));
};

const sentencesIn = (group: Span, cores: readonly Span[]): number => firstStartingAt(cores, group.end) - firstStartingAt(cores, group.start);

/** 文の頭で始まり文の終わりで終わる行のうち、2 文以上を持つもの。固定幅の折り返しでは、行の両端が偶然そろうことはまれ。 */
const wholeMultiSentenceLines = (lines: readonly Line[], closing: readonly boolean[], cores: readonly Span[]): number =>
  lines.filter((line, index) => (index === 0 || closing[index - 1] === true) && closing[index] === true && sentencesIn(line.span, cores) >= 2).length;

/** 行ごとの段落として読む形か。 */
const isLineShaped = (lines: readonly Line[], closing: readonly boolean[], groups: readonly Span[], cores: readonly Span[]): boolean => {
  const closed = closing.filter(Boolean).length;
  const multi = wholeMultiSentenceLines(lines, closing, cores);
  return closed * 2 >= closing.length && multi >= MIN_MULTI_SENTENCE && multi >= groups.length * MULTI_SENTENCE_SHARE;
};

/** paragraph を、書いた人が段落のつもりで改めた行ごとに割る。そう読めなければ paragraph 1 つ。sentences は段落の中の文。 */
export const lineParagraphs = (source: string, paragraph: Span, sentences: readonly Span[]): Span[] => {
  const lines = linesOf(source, paragraph);
  const cores = sentences.map((sentence) => coreOf(source, sentence)).filter((core) => core.end > core.start);
  const closing = lines.map((line) => endsSentence(line, cores));
  const groups = groupAt(lines, closing);
  return isLineShaped(lines, closing, groups, cores) ? groups : [paragraph];
};
