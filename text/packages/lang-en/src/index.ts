import { split, SentenceSplitterSyntax } from "sentence-splitter";
import { loadLexicons } from "./lexicons.ts";
import { isReady, prepare, tokenize } from "./pos.ts";
import type { AdapterNeeds, LanguageAdapter, Segmentation, Sentence } from "chaffjs/plugin";

// chaff からは型だけを取る。実行時の値依存を作らない。アダプタは単体で動く。

const LATIN_LETTER = /[a-z]/giu;
const COUNTABLE = /\S/gu;

/**
 * token の span は文ではなく、segment に渡した文字列を基準にする。文の span と同じ座標系。
 * wink は位置を返さないため、文ごとに解析してから文の開始位置を足す。
 */
const withTokens = (sentence: Sentence): Sentence => {
  const tokens = tokenize(sentence.text);
  if (tokens === undefined) return sentence;
  return {
    ...sentence,
    tokens: tokens.map((token) => ({ ...token, span: { start: sentence.span.start + token.span.start, end: sentence.span.start + token.span.end } })),
  };
};

/**
 * 英語は sentence-splitter の既定で足りる。"Dr." "e.g." "U.S." "$3.50" を
 * いずれも文末と誤認しない。日本語のような後処理は要らない。spec §7.2。
 */
export const adapter: LanguageAdapter = {
  kind: "language",
  id: "en",
  apiVersion: 1,
  capabilities: {
    sentenceSplit: true,
    wordSplit: true,
    // 「払えばできる」の宣言。実際に払うのは prepare。英語は 130 ms ほど。
    pos: true,
    lemma: true,
    lengthUnit: "word",
  },
  prepare: (need: AdapterNeeds): Promise<void> => {
    // 英語の解析器は同期に読める。契約は Promise なので、そこだけ合わせる。
    if (need.pos) prepare();
    return Promise.resolve();
  },
  detect: (source: string): number => {
    const total = [...source.matchAll(COUNTABLE)].length;
    if (total === 0) return 0;
    return [...source.matchAll(LATIN_LETTER)].length / total;
  },
  lexicons: loadLexicons(),
  segment: (text: string): Segmentation => {
    const sentences: Sentence[] = split(text)
      .filter((node) => node.type === SentenceSplitterSyntax.Sentence)
      .map((node) => ({ span: { start: node.range[0], end: node.range[1] }, text: text.slice(node.range[0], node.range[1]) }));
    return { sentences: isReady() ? sentences.map(withTokens) : sentences };
  },
};
