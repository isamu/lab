import type { Detector, DocumentProfile, Finding, Sentence, Span, Token } from "../plugin.ts";
import { compacted } from "./gram-place.ts";
import { leadingCounterLength } from "./counter-edge.ts";
import { maskAddresses } from "../address-chain.ts";
import { isAddressRun } from "./place-run.ts";
import { isOneName } from "./name-run.ts";
import { proseText } from "../measure.ts";
import { parallelDotCount } from "./middle-dot.ts";

/**
 * 文字の並びを見る検出。漢字の連なりが住所か名前かだけは、形態素解析の固有名詞と数で決める。
 * 覆った箇所は空白になっているので、proseText で潰してから数える。
 */
const KANJI_RUN = /[一-鿿]+/gu;

/** 漢字の連なりと、その文書全体の座標での範囲。 */
type KanjiRun = { readonly text: string; readonly span: Span | undefined };

const SPACE = /\s/gu;

/**
 * 同じ連なりが文に二度出ても、それぞれの位置で読む。proseText は空白を詰めたり除いたりするだけなので、
 * 空白でない k 文字目は元の文でも空白でない k 文字目。番地の覆いは長さを保つので、proseText の位置がそのまま使える。
 */
const runsOf = (sentence: Sentence, profile: DocumentProfile | undefined): KanjiRun[] => {
  const prose = proseText(sentence);
  const printed = compacted(sentence.text, "char").offsets;
  return [...maskAddresses(prose, profile).matchAll(KANJI_RUN)].map((match) => {
    const before = prose.slice(0, match.index).replace(SPACE, "").length;
    const [start, last] = [printed[before], printed[before + match[0].length - 1]];
    const span = start === undefined || last === undefined ? undefined : { start: sentence.span.start + start, end: sentence.span.start + last + 1 };
    return { text: match[0], span };
  });
};

/** 漢字の連なりが住所（東京都港区新橋二丁目）か 1 つの名前（日本銀行）か。形態素解析の地名・人名・組織名と数で決める。 */
const isPlaceName = (tokens: readonly Token[], span: Span, topUnits: ReadonlySet<string>): boolean => {
  const covering = tokens.flatMap((token, index) => (token.span.start < span.end && span.start < token.span.end ? [index] : []));
  return isAddressRun(tokens, covering, topUnits) || isOneName(tokens, covering);
};

/**
 * 数えない連なりは空。頭の、数に付いた助数詞（2日日本弁護士連合会の「日」）は数えない。
 * 住所か名前かは、助数詞を外した残りで決める（1日日本銀行の「日本銀行」）。品詞が無ければ判定しない。
 */
const measuredRun = (tokens: readonly Token[] | undefined, run: KanjiRun, topUnits: ReadonlySet<string>): string => {
  if (tokens === undefined || run.span === undefined) return run.text;
  const counter = leadingCounterLength(tokens, run.span.start, run.text);
  return isPlaceName(tokens, { start: run.span.start + counter, end: run.span.end }, topUnits) ? "" : run.text.slice(counter);
};

const longestKanji = (sentence: Sentence, profile: DocumentProfile | undefined, topUnits: ReadonlySet<string>): string =>
  runsOf(sentence, profile)
    .map((run) => measuredRun(sentence.tokens, run, topUnits))
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

/**
 * 中黒で並べると、どこまでが 1 つの項目か分からなくなる。
 * 「企画・開発・運用・保守体制」は、保守体制が 1 つなのか保守と体制なのか読めない。
 */
export const middleDot: Detector = (doc, options): Finding[] =>
  doc.sentences
    .map((sentence) => ({ sentence, count: parallelDotCount(sentence.text) }))
    .filter(({ count }) => count > options.limit)
    .map(({ sentence, count }) => ({
      rule: "no-nakaguro-parallel",
      severity: "info",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { count, limit: options.limit, offset: sentence.span.start },
    }));
