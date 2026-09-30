// 日本語の語と語のあいだの空白。どの境目を数えるかを品詞で決める。
import type { Sentence, Span, Token } from "./plugin.ts";
import { isJapanese } from "./orthography.ts";
import { isWithinAny, quotedIn } from "./quoted-span.ts";

/** between-phrases は助詞の後ろ（文節の切れ目）、inside-phrase は文節を始められない語の前（助詞・助動詞・名詞に続く「する」）。 */
export type JointKind = "between-phrases" | "inside-phrase";

/** offset は前の語の終わり（文書の座標）。before / after は境目の両側の語。 */
export type Joint = { readonly offset: number; readonly kind: JointKind; readonly spaced: boolean; readonly before: string; readonly after: string };

const SPACES = /^[ \u3000]+$/u;
const PARTICLE = new Set(["ADP", "SCONJ"]);
// 文節の頭に立てない語。「確認 しました」の「する」は名詞の後ろのときだけ（「し始める」の「し」は動詞の頭に立つ）。
const BOUND = new Set(["ADP", "SCONJ", "PART", "AUX"]);
const LIGHT_VERB = "する";

/**
 * 空白の後ろの「が」を、解析器は文頭の接続詞（「が、」）と読む。一字の接続詞（が・と・や・か）は助詞として扱う。
 * 二字以上（また・なお）は文節を始める接続詞。
 */
const isBound = (token: Token): boolean => BOUND.has(token.pos) || (token.pos === "CCONJ" && [...token.surface].length === 1);

const kindOf = (left: Token, right: Token): JointKind | undefined => {
  if (isBound(right) || (right.lemma === LIGHT_VERB && left.pos === "NOUN")) return "inside-phrase";
  // 名詞どうし（担当 田中、赤坂 文弥、フルデスクトップ モード）は名札・名前・複合語の書き方で、数えない。
  return PARTICLE.has(left.pos) ? "between-phrases" : undefined;
};

/** 行（か文）の頭の語か。行頭の「ヘ」「イ」は項目の記号で、後ろの空白は記号と本文の区切り。 */
const isLineHead = (text: string, at: number): boolean => text.slice(text.lastIndexOf("\n", at - 1) + 1, at).trim() === "";

const isWord = (token: Token): boolean => token.surface.trim() !== "";

type Pair = { readonly left: Token; readonly right: Token };

const pairsOf = (tokens: readonly Token[]): Pair[] =>
  tokens.filter(isWord).flatMap((right, index, words) => {
    const left = words[index - 1];
    return left === undefined ? [] : [{ left, right }];
  });

// 強調とリンクの括弧。読み手には見えない。
const CHROME = /[*_~[\]]/gu;

/**
 * 空けたか詰めたか。間が何も無いか強調・リンクの括弧だけなら詰めた、書き手が書いた空白（半角・全角）だけなら空けた。
 * 括弧の隣の空白（「**…こと** とする」「手順は [README]」）は、日本語の隣で強調が効かない Markdown のための空白なので数えない。
 * 改行（Markdown の改行や、行の折り返し）や、見える字を覆った空白（コード）をまたぐ語も、境目に数えない。
 */
const spacing = (sentence: Sentence, written: string, pair: Pair): boolean | undefined => {
  const [from, to] = [pair.left.span.end - sentence.span.start, pair.right.span.start - sentence.span.start];
  const gap = written.slice(from, to);
  if (gap.replace(CHROME, "") === "") return false;
  return SPACES.test(gap) ? true : undefined;
};

const jointOf = (sentence: Sentence, written: string, quoted: readonly Span[], pair: Pair): Joint | undefined => {
  const { left, right } = pair;
  if (!isJapanese(left.surface.at(-1)) || !isJapanese(right.surface.at(0))) return undefined;
  const spaced = spacing(sentence, written, pair);
  if (spaced === undefined || isWithinAny(quoted, { start: left.span.start, end: right.span.end })) return undefined;
  if (isLineHead(sentence.text, left.span.start - sentence.span.start)) return undefined;
  const kind = kindOf(left, right);
  return kind === undefined ? undefined : { offset: left.span.end, kind, spaced, before: left.surface, after: right.surface };
};

/**
 * 文の中の、日本語の語と語の境目のうち、空けるか詰めるかを数えるもの。written は本文でないものを覆う前の、文と同じ範囲。
 * 英字・数字との境目は latin-spacing が見るので入れない。
 */
export const phraseJoints = (sentence: Sentence, written: string): Joint[] => {
  const quoted = quotedIn(sentence);
  return pairsOf(sentence.tokens ?? []).flatMap((pair) => {
    const joint = jointOf(sentence, written, quoted, pair);
    return joint === undefined ? [] : [joint];
  });
};
