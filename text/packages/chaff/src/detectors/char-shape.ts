import type { Detector, DocumentProfile, Finding, Sentence } from "../plugin.ts";
import { maskAddresses } from "../address-chain.ts";
import { proseText } from "../measure.ts";

/**
 * 文字の並びだけを見る検出。品詞も語彙表も要らない。
 * 覆った箇所は空白になっているので、proseText で潰してから数える。
 */
const KANJI_RUN = /[一-鿿]+/gu;

/** 漢字の連なりの全体が、言語パッケージの語彙表（unsplittable）の書き方か。住所のように、漢字が続いても割れないもの。 */
const isUnsplittable = (run: string, patterns: readonly RegExp[]): boolean => patterns.some((pattern) => pattern.test(run));

const longestKanji = (sentence: Sentence, profile: DocumentProfile | undefined, unsplittable: readonly RegExp[]): string =>
  [...maskAddresses(proseText(sentence), profile).matchAll(KANJI_RUN)]
    .map((match) => match[0])
    .filter((run) => !isUnsplittable(run, unsplittable))
    .reduce((longest, run) => (run.length > longest.length ? run : longest), "");

const compiled = new Map<string, RegExp>();
/** 連なりの全体に当てる。一部だけ当たるもの（住所の後ろに別の語が続く）は割れない書き方ではない。 */
const patternOf = (source: string): RegExp => {
  const found = compiled.get(source) ?? new RegExp(`^(?:${source})$`, "u");
  compiled.set(source, found);
  return found;
};

/**
 * 漢字が続くと、どこで語が切れるのか読み手が探すことになる。
 * 「情報処理推進機構認定試験」は 12 字。ひらがなを 1 つ挟むだけで読める。
 */
export const kanjiRun: Detector = (doc, options): Finding[] => {
  const unsplittable = (doc.lexicons["unsplittable"] ?? []).map((entry) => patternOf(entry.pattern));
  return doc.sentences
    .map((sentence) => ({ sentence, run: longestKanji(sentence, doc.profile, unsplittable) }))
    .filter(({ run }) => run.length > options.limit)
    .map(({ sentence, run }) => ({
      rule: "max-kanji-continuous",
      severity: "warning",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { word: run, count: run.length, limit: options.limit, offset: sentence.span.start },
    }));
};

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
