import { loadLexicons } from "./lexicons.ts";
import { closesSentence } from "./sentence-close.ts";
import { sentenceSpans } from "./sentence-split.ts";
import { isEnglishBoundary, isEnglishRun } from "./english-run.ts";
import { unmarkNumberStops } from "./number-stop.ts";
import { labelStops, unmarkLabelStops } from "./label-stop.ts";
import { splitAtQuotedStops } from "./quoted-stop.ts";
import { reattachClosingQuotes } from "./closing-quote.ts";
import { insideBrackets, startsWithCloser } from "./inside-brackets.ts";
import { structure } from "./structure.ts";
import { isReady, predicateOnly, prepare, readsAsCounter, readsAsOneAdverb, readsAsOneWord, tokenize } from "./pos.ts";
import { markSpacedCounters } from "./spaced-counter.ts";
import { tokensWithin } from "./tokens-within.ts";
import { distributiveVocabulary, iterationMarkReading, markReduplication } from "./reduplication.ts";
import { knownWordReading, markDroppedLongVowels, remembered } from "./long-vowel-form.ts";
import type { AdapterNeeds, EmbeddedLanguage, LanguageAdapter, Segmentation, Sentence, Span } from "chaffjs/plugin";

// chaff からは型だけを取る。実行時の値依存を作らない。アダプタは単体で動く。

const JAPANESE = /[぀-ゟ゠-ヿ一-鿿]/gu;
const COUNTABLE = /\S/gu;

/**
 * 日本語の文末は「。！？」と、語の後の「．」に限られる（closesSentence）。
 *
 * sentence-splitter は "." も文末と見なすため、「、Dr. 田中は」で誤分割する。
 * AbbrMarker の language を差し替えても直らない。原因は略語の保護ではなく、
 * "." を終端と見なすこと自体にあるため。spec §7.2。
 *
 * 文長は sentence-rhythm と max-sentence-length の入力なので、
 * 誤分割はそのまま指標を動かす。ここで閉じる。
 */
const isOpen = (text: string): boolean => text.trim().length > 0 && !closesSentence(text);

/**
 * 和文の句点で閉じていない断片、括弧・二重引用符の中で切れた断片、閉じ括弧で始まる断片の前は次へ続く。
 * 閉じ括弧は閉じる文に付き、後ろは分割器が組にした括弧（「…。」と言った）と同じく同じ文に続く。
 * ただし英文どうしは、英語のアダプタと同じく英語の文末で切ったところで切る。
 */
const continues = (before: string, after: string, bracketOpen: boolean): boolean =>
  (isOpen(before) || bracketOpen || startsWithCloser(after)) && !isEnglishBoundary(before, after);

const LINE_BREAK = /[\n\r]/u;

const ENGLISH: EmbeddedLanguage = { id: "en", lengthUnit: "word" };

const withLanguage = (text: string, span: Span): Sentence => (isEnglishRun(text) ? { span, text, embeddedLanguage: ENGLISH } : { span, text });

/**
 * 断片を繋ぐときは raw の連結ではなくオフセットを使う。
 * sentence-splitter は空白を別ノードに分けるため、raw を繋ぐと空白が落ちて文長が縮む。
 */
const merge = (source: string, spans: readonly Span[]): Sentence[] => {
  const open = insideBrackets(source);
  return spans
    .reduce<Span[]>((acc, span) => {
      const last = acc.at(-1);
      // 断片の「間」に改行があれば繋がない。結合は「Dr. 田中」のような行の途中の
      // 誤分割を閉じるためのもので、行またぎは要らない。またぐと、引用ブロックの
      // 英文と訳文のように別の行のものまで 1 文に繋がる。
      const acrossLines = last !== undefined && LINE_BREAK.test(source.slice(last.end, span.start));
      if (last !== undefined && !acrossLines && continues(source.slice(last.start, last.end), source.slice(span.start, span.end), open[last.end] === true))
        acc[acc.length - 1] = { start: last.start, end: span.end };
      else acc.push(span);
      return acc;
    }, [])
    .map((span) => withLanguage(source.slice(span.start, span.end), span));
};

/**
 * token の span は文ではなく、segment に渡した文字列を基準にする。文の span と同じ座標系。
 * 文ごとに解析して足し戻すのではなく、一度解析して文へ配る。同じ文字列を二度読まない。
 */
const LEXICONS = loadLexicons();
const DISTRIBUTIVE = distributiveVocabulary(LEXICONS);
const TAKES_ITERATION_MARK = iterationMarkReading(LEXICONS, readsAsOneWord);
const KNOWS_WITH_LONG_VOWEL = remembered(knownWordReading(tokenize));

const withTokens = (source: string, sentences: readonly Sentence[]): Sentence[] => {
  const read = tokenize(source);
  if (read === undefined) return [...sentences];
  const tokens = markDroppedLongVowels(markSpacedCounters(read, readsAsCounter), KNOWS_WITH_LONG_VOWEL);
  return sentences.map((sentence) => ({
    ...sentence,
    // 述語かどうかは文の中でしか決まらないので、文へ配ってから印を落とす。
    tokens: markReduplication(predicateOnly(tokensWithin(tokens, sentence.span)), DISTRIBUTIVE, readsAsOneAdverb, TAKES_ITERATION_MARK),
  }));
};

const LABEL_STOPS = labelStops((LEXICONS["abbreviated-label"] ?? []).map((entry) => entry.pattern));

/**
 * 英語のアダプタと同じ手当てを英文にも当てる。番号の前の略した名前（FIG. 1）の点で切らず、
 * 英文の閉じ引用符の内側の句点で切り、文頭に取り残された閉じ引用符を前の文へ戻す。
 */
const spansOf = (text: string): Span[] => {
  const spans = sentenceSpans(unmarkNumberStops(unmarkLabelStops(text, LABEL_STOPS)));
  const quotedStops = spans.flatMap((span) => (isEnglishRun(text.slice(span.start, span.end)) ? splitAtQuotedStops(text, span) : [span]));
  return reattachClosingQuotes(text, quotedStops);
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
    const sentences = merge(text, spansOf(text));
    return { sentences: isReady() ? withTokens(text, sentences) : sentences };
  },
};
