import type { Detector, Finding, Sentence } from "../plugin.ts";
import { proseText } from "../measure.ts";

/**
 * 文字の並びだけを見る検出。品詞も語彙表も要らない。
 * 覆った箇所は空白になっているので、proseText で潰してから数える。
 */
const KANJI_RUN = /[一-鿿]+/gu;

const longestKanji = (sentence: Sentence): string =>
  [...proseText(sentence).matchAll(KANJI_RUN)].reduce((longest, match) => (match[0].length > longest.length ? match[0] : longest), "");

/**
 * 漢字が続くと、どこで語が切れるのか読み手が探すことになる。
 * 「情報処理推進機構認定試験」は 12 字。ひらがなを 1 つ挟むだけで読める。
 */
export const kanjiRun: Detector = (doc, options): Finding[] =>
  doc.sentences
    .map((sentence) => ({ sentence, run: longestKanji(sentence) }))
    .filter(({ run }) => run.length > options.limit)
    .map(({ sentence, run }) => ({
      rule: "max-kanji-continuous",
      severity: "warning",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { word: run, count: run.length, limit: options.limit, offset: sentence.span.start },
    }));

const MIDDLE_DOT = /・/gu;

/**
 * 中黒で並べると、どこまでが 1 つの項目か分からなくなる。
 * 「企画・開発・運用・保守体制」は、保守体制が 1 つなのか保守と体制なのか読めない。
 */
export const middleDot: Detector = (doc, options): Finding[] =>
  doc.sentences
    .map((sentence) => ({ sentence, count: [...proseText(sentence).matchAll(MIDDLE_DOT)].length }))
    .filter(({ count }) => count > options.limit)
    .map(({ sentence, count }) => ({
      rule: "no-nakaguro-parallel",
      severity: "info",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { count, limit: options.limit, offset: sentence.span.start },
    }));
