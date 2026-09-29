import { joinWords } from "./word-list.ts";
import { wordsOf } from "./structure.ts";
import type { Detector, Finding, Lexicon, ProseDocument, Sentence } from "../plugin.ts";
import { entryIn, entryOpens } from "./lexicon-match.ts";

const PER = 1000;

/** 密度を見る rule は短い文書を測らない。単位は言語で違うので床も分ける。 */
const FLOOR = { word: 200, char: 500 };

type Hit = { readonly sentence: Sentence; readonly matched: string };

const hitsFor = (doc: ProseDocument, lexicon: Lexicon): Hit[] =>
  doc.sentences.flatMap((sentence) => lexicon.filter((entry) => entryIn(sentence, entry)).map((entry) => ({ sentence, matched: entry.pattern })));

/**
 * 単位長あたりの出現率。件数で数えると長い文書ほど当たる（bold-density と同じ）。
 * rule の id は呼び出し側が持つ。detector は「密度が閾値を超えたか」しか知らない。
 */
const densityRule =
  (rule: string): Detector =>
  (doc, options): Finding[] => {
    const hits = hitsFor(doc, options.lexicon ?? []);
    const length = wordsOf(doc);
    const rate = length === 0 ? 0 : Math.round((hits.length / length) * PER);
    const first = hits[0];
    if (length < FLOOR[doc.lengthUnit] || first === undefined || rate <= options.limit) return [];
    return hits.map((hit) => ({
      rule,
      severity: "warning",
      line: 0,
      column: 0,
      quote: hit.sentence.text.trim(),
      values: { matched: hit.matched, count: hits.length, density: rate, limit: options.limit, offset: hit.sentence.span.start },
    }));
  };

export const hedgingDensity = densityRule("excessive-hedging");
export const cushionDensity = densityRule("cushion-phrase-density");

/** 数字は語ではないので言語を問わない。数があれば測った結果を言っている。品詞の数（NUM）は "the best one" の one まで含むので使わない。 */
const DIGIT = /\d/u;

const COMPARISON_MARKER = "comparison-marker";

const qualified = (sentence: Sentence, markers: Lexicon): boolean => DIGIT.test(sentence.text) || markers.some((entry) => entryIn(sentence, entry));

/**
 * 限定のない最上級。「最も速い」だけでは、何と比べて最もなのかが無い。
 * 同じ文に比較対象や条件があれば、それは主張であって誇張ではない。比較を言う語は言語パッケージの語彙表が持つ。
 */
export const unqualifiedSuperlative: Detector = (doc, options): Finding[] => {
  const markers = doc.lexicons[COMPARISON_MARKER] ?? [];
  const bare = hitsFor(doc, options.lexicon ?? []).filter((hit) => !qualified(hit.sentence, markers));
  if (bare.length < options.limit) return [];
  return bare.map((hit) => ({
    rule: "unqualified-superlative",
    severity: "warning",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { matched: hit.matched, count: bare.length, limit: options.limit, offset: hit.sentence.span.start },
  }));
};

const openerOf = (doc: ProseDocument, lexicon: Lexicon): (string | undefined)[] =>
  doc.paragraphs.map((paragraph) => {
    const head = paragraph.sentences[0];
    return head === undefined ? undefined : lexicon.find((entry) => entryOpens(head, entry))?.pattern;
  });

/**
 * 段落が同じ接続詞で始まり続ける。1 つなら流れを作るが、続くとどの段落も
 * 前の段落の付け足しに見えて、話がどこへ向かっているのか分からなくなる。
 */
export const repeatedConjunction: Detector = (doc, options): Finding[] => {
  const openers = openerOf(doc, options.lexicon ?? []);
  const runs = openers.reduce<{ runs: number[][]; current: number[] }>(
    (acc, opener, index) => {
      if (opener === undefined) return { runs: [...acc.runs, acc.current], current: [] };
      return { runs: acc.runs, current: [...acc.current, index] };
    },
    { runs: [], current: [] },
  );
  return [...runs.runs, runs.current]
    .filter((run) => run.length > options.limit)
    .flatMap((run) => {
      const at = doc.paragraphs[run[0] ?? 0];
      return at === undefined
        ? []
        : [
            {
              rule: "repeated-conjunction",
              severity: "warning" as const,
              line: 0,
              column: 0,
              quote: at.sentences[0]?.text.trim() ?? "",
              values: { count: run.length, limit: options.limit, offset: at.span.start },
            },
          ];
    });
};

/**
 * AI 生成の signal。1 つでは何も言えないので、重みを足し合わせて文書の点にする。
 * 単独で断じない。§20.2 の複合シグナルの入口で、これだけで「AI が書いた」とは言わない。
 */
export const aiTell: Detector = (doc, options): Finding[] => {
  const entries = [...new Map((options.lexicon ?? []).map((entry) => [entry.pattern.toLowerCase(), entry])).values()];
  const found = entries.filter((entry) => doc.sentences.some((sentence) => entryIn(sentence, entry)));
  const score = Math.round(found.reduce((sum, entry) => sum + (entry.weight ?? 1), 0) * 10);
  const first = doc.sentences.find((sentence) => found.some((entry) => entryIn(sentence, entry)));
  if (first === undefined || score <= options.limit) return [];
  return [
    {
      rule: "ai-tell",
      severity: "info",
      line: 0,
      column: 0,
      quote: first.text.trim(),
      values: {
        word: joinWords(
          found.map((entry) => entry.pattern.toLowerCase()),
          doc.language,
        ),
        count: found.length,
        density: score,
        limit: options.limit,
        offset: first.span.start,
      },
    },
  ];
};

/**
 * 同じことを言う 2 つの書きかたが、1 つの文書で混ざっているか。
 *
 * **どちらが正しいかは決めない。** 短縮形を使うかどうかは文体の選択で、
 * 立場を取ると方針の違う書き手に rule ごと無視される。spec §12.3。
 *
 * 語彙表は対を持つ（`pattern` と `instead_of`）。片方だけを数えても、
 * 意図した硬い文体なのか不統一なのかが分からない。
 */
/**
 * 語の境界で照合する。部分一致だと「it isn't」が「it is」を含んでしまい、
 * 短縮形を使っている文が「使っていない」側に数えられる。
 */
const containsWord = (text: string, word: string): boolean => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\b`, "u").test(text);

export const contractionMix: Detector = (doc, options): Finding[] => {
  const pairs = (options.lexicon ?? []).flatMap((entry) => (entry.instead_of === undefined ? [] : [{ short: entry.pattern, long: entry.instead_of }]));
  const body = doc.sentences.map((sentence) => sentence.text.toLowerCase()).join(" ");
  const used = pairs.filter((pair) => containsWord(body, pair.short.toLowerCase()));
  const spelled = pairs.filter((pair) => containsWord(body, pair.long.toLowerCase()));
  // 片方しか無ければ一貫している。両方あるときだけ、少数派を指摘する。
  if (used.length === 0 || spelled.length === 0) return [];
  const minorityIsShort = used.length <= spelled.length;
  const few = minorityIsShort ? used : spelled;
  if (few.length > options.limit) return [];
  const wanted = few.map((pair) => (minorityIsShort ? pair.short : pair.long).toLowerCase());
  const hits = doc.sentences.flatMap((sentence) => {
    const text = sentence.text.toLowerCase();
    const matched = wanted.find((word) => containsWord(text, word));
    return matched === undefined ? [] : [{ sentence, matched }];
  });
  return hits.map((hit) => ({
    rule: "contraction-consistency",
    severity: "info",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { matched: hit.matched, count: few.length, limit: options.limit, offset: hit.sentence.span.start },
  }));
};
