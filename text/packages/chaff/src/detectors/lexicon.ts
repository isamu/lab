import { proseText } from "../measure.ts";
import { wordsOf } from "./structure.ts";
import type { Detector, Finding, ProseDocument, Sentence } from "../plugin.ts";

const PER = 1000;

/** 密度を見る rule は短い文書を測らない。単位は言語で違うので床も分ける。 */
const FLOOR = { word: 200, char: 500 };

type Hit = { readonly sentence: Sentence; readonly matched: string };

const hitsFor = (doc: ProseDocument, patterns: readonly string[]): Hit[] =>
  doc.sentences.flatMap((sentence) => {
    const text = sentence.text.toLowerCase();
    return patterns.filter((pattern) => text.includes(pattern.toLowerCase())).map((matched) => ({ sentence, matched }));
  });

/**
 * 単位長あたりの出現率。件数で数えると長い文書ほど当たる（bold-density と同じ）。
 * rule の id は呼び出し側が持つ。detector は「密度が閾値を超えたか」しか知らない。
 */
const densityRule =
  (rule: string): Detector =>
  (doc, options): Finding[] => {
    const patterns = (options.lexicon ?? []).map((entry) => entry.pattern);
    const hits = hitsFor(doc, patterns);
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

/**
 * 限定のない最上級。「最も速い」だけでは、何と比べて最もなのかが無い。
 * 同じ文に比較対象や条件があれば、それは主張であって誇張ではない。
 */
const QUALIFIER = /\d|より|に比べ|のうち|among|than|compared|based on|according/iu;

export const unqualifiedSuperlative: Detector = (doc, options): Finding[] => {
  const patterns = (options.lexicon ?? []).map((entry) => entry.pattern);
  const bare = hitsFor(doc, patterns).filter((hit) => !QUALIFIER.test(hit.sentence.text));
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

const openerOf = (doc: ProseDocument, patterns: readonly string[]): (string | undefined)[] =>
  doc.paragraphs.map((paragraph) => {
    const head = paragraph.sentences[0]?.text.trim().toLowerCase() ?? "";
    return patterns.find((pattern) => head.startsWith(pattern.toLowerCase()));
  });

/**
 * 段落が同じ接続詞で始まり続ける。1 つなら流れを作るが、続くとどの段落も
 * 前の段落の付け足しに見えて、話がどこへ向かっているのか分からなくなる。
 */
export const repeatedConjunction: Detector = (doc, options): Finding[] => {
  const patterns = (options.lexicon ?? []).map((entry) => entry.pattern);
  const openers = openerOf(doc, patterns);
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
  const weights = new Map((options.lexicon ?? []).map((entry) => [entry.pattern.toLowerCase(), entry.weight ?? 1]));
  const body = doc.sentences.map(proseText).join(" ").toLowerCase();
  const found = [...weights.entries()].filter(([pattern]) => body.includes(pattern));
  const score = Math.round(found.reduce((sum, [, weight]) => sum + weight, 0) * 10);
  const first = doc.sentences.find((sentence) => found.some(([pattern]) => sentence.text.toLowerCase().includes(pattern)));
  if (first === undefined || score <= options.limit) return [];
  return [
    {
      rule: "ai-tell",
      severity: "info",
      line: 0,
      column: 0,
      quote: first.text.trim(),
      values: { word: found.map(([pattern]) => pattern).join("、"), count: found.length, density: score, limit: options.limit, offset: first.span.start },
    },
  ];
};
