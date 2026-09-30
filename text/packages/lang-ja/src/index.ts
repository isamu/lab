import { loadLexicons } from "./lexicons.ts";
import { sentenceSpans } from "./sentence-split.ts";
import { structure } from "./structure.ts";
import { isReady, predicateOnly, prepare, readsAsCounter, readsAsOneAdverb, readsAsOneWord, tokenize } from "./pos.ts";
import { markSpacedCounters } from "./spaced-counter.ts";
import { tokensWithin } from "./tokens-within.ts";
import { distributiveVocabulary, iterationMarkReading, markReduplication } from "./reduplication.ts";
import type { AdapterNeeds, LanguageAdapter, Segmentation, Sentence, Span } from "chaffjs/plugin";

// chaff からは型だけを取る。実行時の値依存を作らない。アダプタは単体で動く。

/**
 * 日本語の文末は「。！？」に限られる。
 *
 * sentence-splitter は "." も文末と見なすため、「、Dr. 田中は」で誤分割する。
 * AbbrMarker の language を差し替えても直らない。原因は略語の保護ではなく、
 * "." を終端と見なすこと自体にあるため。spec §7.2。
 *
 * 文長は sentence-rhythm と max-sentence-length の入力なので、
 * 誤分割はそのまま指標を動かす。ここで閉じる。
 */
const CLOSED = /[。！？!?][")）」』]*\s*$/u;

const JAPANESE = /[぀-ゟ゠-ヿ一-鿿]/gu;
const COUNTABLE = /\S/gu;

const isOpen = (text: string): boolean => text.trim().length > 0 && !CLOSED.test(text);

/**
 * 断片を繋ぐときは raw の連結ではなくオフセットを使う。
 * sentence-splitter は空白を別ノードに分けるため、raw を繋ぐと空白が落ちて文長が縮む。
 */
const merge = (source: string, spans: readonly Span[]): Sentence[] =>
  spans
    .reduce<Span[]>((acc, span) => {
      const last = acc.at(-1);
      // 断片の「間」に改行があれば繋がない。結合は「Dr. 田中」のような行の途中の
      // 誤分割を閉じるためのもので、行またぎは要らない。またぐと、引用ブロックの
      // 英文と訳文のように別の行のものまで 1 文に繋がる。
      const acrossLines = last !== undefined && source.slice(last.end, span.start).includes("\n");
      if (last !== undefined && !acrossLines && isOpen(source.slice(last.start, last.end))) acc[acc.length - 1] = { start: last.start, end: span.end };
      else acc.push(span);
      return acc;
    }, [])
    .map((span) => ({ span, text: source.slice(span.start, span.end) }));

/**
 * token の span は文ではなく、segment に渡した文字列を基準にする。文の span と同じ座標系。
 * 文ごとに解析して足し戻すのではなく、一度解析して文へ配る。同じ文字列を二度読まない。
 */
const LEXICONS = loadLexicons();
const DISTRIBUTIVE = distributiveVocabulary(LEXICONS);
const TAKES_ITERATION_MARK = iterationMarkReading(LEXICONS, readsAsOneWord);

const withTokens = (source: string, sentences: readonly Sentence[]): Sentence[] => {
  const read = tokenize(source);
  if (read === undefined) return [...sentences];
  const tokens = markSpacedCounters(read, readsAsCounter);
  return sentences.map((sentence) => ({
    ...sentence,
    // 述語かどうかは文の中でしか決まらないので、文へ配ってから印を落とす。
    tokens: markReduplication(predicateOnly(tokensWithin(tokens, sentence.span)), DISTRIBUTIVE, readsAsOneAdverb, TAKES_ITERATION_MARK),
  }));
};

export const adapter: LanguageAdapter = {
  kind: "language",
  id: "ja",
  apiVersion: 1,
  capabilities: {
    sentenceSplit: true,
    // 「払えばできる」の宣言。実際に払うのは prepare。辞書の初期化に 1.5 秒かかる。
    wordSplit: true,
    pos: true,
    lemma: true,
    lengthUnit: "char",
  },
  prepare: async (need: AdapterNeeds): Promise<void> => {
    if (need.pos) await prepare();
  },
  detect: (source: string): number => {
    const total = [...source.matchAll(COUNTABLE)].length;
    if (total === 0) return 0;
    return [...source.matchAll(JAPANESE)].length / total;
  },
  lexicons: loadLexicons(),
  structure,
  segment: (text: string): Segmentation => {
    const sentences = merge(text, sentenceSpans(text));
    return { sentences: isReady() ? withTokens(text, sentences) : sentences };
  },
};
