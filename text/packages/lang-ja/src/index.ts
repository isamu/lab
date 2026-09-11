import { split, SentenceSplitterSyntax } from "sentence-splitter";
import type { LanguageAdapter, Segmentation, Sentence, Span } from "chaff/plugin";

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

const rawSpans = (text: string): Span[] =>
  split(text)
    .filter((node) => node.type === SentenceSplitterSyntax.Sentence)
    .map((node) => ({ start: node.range[0], end: node.range[1] }));

/**
 * 断片を繋ぐときは raw の連結ではなくオフセットを使う。
 * sentence-splitter は空白を別ノードに分けるため、raw を繋ぐと空白が落ちて文長が縮む。
 */
const merge = (source: string, spans: readonly Span[]): Sentence[] =>
  spans
    .reduce<Span[]>((acc, span) => {
      const last = acc.at(-1);
      if (last !== undefined && isOpen(source.slice(last.start, last.end))) {
        return [...acc.slice(0, -1), { start: last.start, end: span.end }];
      }
      return [...acc, span];
    }, [])
    .map((span) => ({ span, text: source.slice(span.start, span.end) }));

export const adapter: LanguageAdapter = {
  kind: "language",
  id: "ja",
  apiVersion: 1,
  capabilities: {
    sentenceSplit: true,
    // budoux も形態素解析も、まだ繋いでいない。spec §16 の Tier 0。
    wordSplit: false,
    pos: false,
    lemma: false,
    lengthUnit: "char",
  },
  detect: (source: string): number => {
    const total = [...source.matchAll(COUNTABLE)].length;
    if (total === 0) return 0;
    return [...source.matchAll(JAPANESE)].length / total;
  },
  segment: (text: string): Segmentation => ({ sentences: merge(text, rawSpans(text)) }),
};
