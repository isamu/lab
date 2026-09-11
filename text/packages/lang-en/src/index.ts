import { split, SentenceSplitterSyntax } from "sentence-splitter";
import { loadLexicons } from "./lexicons.ts";
import type { LanguageAdapter, Segmentation } from "chaff/plugin";

// chaff からは型だけを取る。実行時の値依存を作らない。アダプタは単体で動く。

const LATIN_LETTER = /[a-z]/giu;
const COUNTABLE = /\S/gu;

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
    pos: false,
    lemma: false,
    lengthUnit: "word",
  },
  detect: (source: string): number => {
    const total = [...source.matchAll(COUNTABLE)].length;
    if (total === 0) return 0;
    return [...source.matchAll(LATIN_LETTER)].length / total;
  },
  lexicons: loadLexicons(),
  segment: (text: string): Segmentation => ({
    sentences: split(text)
      .filter((node) => node.type === SentenceSplitterSyntax.Sentence)
      .map((node) => ({ span: { start: node.range[0], end: node.range[1] }, text: text.slice(node.range[0], node.range[1]) })),
  }),
};
