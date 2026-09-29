import type { Detector, DocumentProfile, Finding, Sentence } from "../plugin.ts";
import { compacted, placeOf } from "./gram-place.ts";
import { maskAddresses } from "../address-chain.ts";
import { isAddressRun } from "./place-run.ts";
import { proseText } from "../measure.ts";

/**
 * 文字の並びを見る検出。漢字の連なりが住所かどうかだけは、形態素解析の地名と数で決める。
 * 覆った箇所は空白になっているので、proseText で潰してから数える。
 */
const KANJI_RUN = /[一-鿿]+/gu;

/** 漢字の連なりが住所か（東京都港区新橋二丁目）。形態素解析の地名と数で決める。品詞が無ければ判定しない。 */
const isPlaceName = (sentence: Sentence, run: string, topUnits: ReadonlySet<string>): boolean => {
  const tokens = sentence.tokens;
  const place = tokens === undefined ? undefined : placeOf(compacted(sentence.text, "word"), run);
  if (tokens === undefined || place === undefined) return false;
  const [start, end] = [sentence.span.start + place.start, sentence.span.start + place.end];
  const covering = tokens.flatMap((token, index) => (token.span.start < end && start < token.span.end ? [index] : []));
  return isAddressRun(tokens, covering, topUnits);
};

const longestKanji = (sentence: Sentence, profile: DocumentProfile | undefined, topUnits: ReadonlySet<string>): string =>
  [...maskAddresses(proseText(sentence), profile).matchAll(KANJI_RUN)]
    .map((match) => match[0])
    .filter((run) => !isPlaceName(sentence, run, topUnits))
    .reduce((longest, run) => (run.length > longest.length ? run : longest), "");

/**
 * 漢字が続くと、どこで語が切れるのか読み手が探すことになる。
 * 「情報処理推進機構認定試験」は 12 字。ひらがなを 1 つ挟むだけで読める。
 */
export const kanjiRun: Detector = (doc, options): Finding[] => {
  const topUnits = new Set((doc.lexicons["prefecture-unit"] ?? []).map((entry) => entry.pattern));
  return doc.sentences
    .map((sentence) => ({ sentence, run: longestKanji(sentence, doc.profile, topUnits) }))
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
