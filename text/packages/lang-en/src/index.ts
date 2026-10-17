import { loadLexicons } from "./lexicons.ts";
import { unmarkNumberStops } from "./number-stop.ts";
import { labelStops, unmarkLabelStops } from "./label-stop.ts";
import { sentenceSpans } from "./sentence-split.ts";
import { splitAtQuotedStops } from "./quoted-stop.ts";
import { reattachClosingQuotes } from "./closing-quote.ts";
import { structure } from "./structure.ts";
import { dictionary } from "./dictionary.ts";
import { isReady, prepare, tokenize } from "./pos.ts";
import { isJapaneseRun } from "./japanese-run.ts";
import { cutAtBreaks, listItemHeads, listLineBreaks, startsListItem } from "./list-line.ts";
import type { AdapterNeeds, EmbeddedLanguage, LanguageAdapter, Segmentation, Sentence, Span } from "chaffjs/plugin";

// chaff からは型だけを取る。実行時の値依存を作らない。アダプタは単体で動く。

const LEXICONS = loadLexicons();
const LABEL_STOPS = labelStops((LEXICONS["abbreviated-label"] ?? []).map((entry) => entry.pattern));

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

const JAPANESE: EmbeddedLanguage = { id: "ja", lengthUnit: "char" };

const withLanguage = (text: string, span: Span): Sentence => (isJapaneseRun(text) ? { span, text, embeddedLanguage: JAPANESE } : { span, text });

const asListItem = (sentence: Sentence): Sentence => ({ ...sentence, listItem: true });

/** Spans of the splitter, cut again where a line break before a list item ends a sentence. */
const sentencesOf = (text: string): Sentence[] => {
  const quotedStops = sentenceSpans(unmarkNumberStops(unmarkLabelStops(text, LABEL_STOPS))).flatMap((span) => splitAtQuotedStops(text, span));
  const listBreaks = listLineBreaks(text);
  const itemHeads = listItemHeads(text);
  return reattachClosingQuotes(text, quotedStops)
    .flatMap((span) => cutAtBreaks(span, listBreaks))
    .map((span) => withLanguage(text.slice(span.start, span.end), span))
    .map((sentence) => (startsListItem(itemHeads, sentence.span.start) ? asListItem(sentence) : sentence));
};

/**
 * 英語は sentence-splitter の既定にほぼ任せる。"Dr." "e.g." "U.S." "$3.50" を
 * いずれも文末と誤認しない。前処理は行の途中の番号を箇条書きと読ませることと、番号の前の略した名前（FIG. 1、Vol. XLIII）の点で切らないこと、後処理は閉じ引用符の内側で閉じた文を切ることと、文頭に取り残された閉じ引用符を前の文へ戻すこと、1 行 1 項目の箇条書きを項目ごとの文に切ること。spec §7.2。
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
  lexicons: LEXICONS,
  structure,
  dictionary,
  segment: (text: string): Segmentation => {
    const sentences = sentencesOf(text);
    return { sentences: isReady() ? sentences.map(withTokens) : sentences };
  },
};
